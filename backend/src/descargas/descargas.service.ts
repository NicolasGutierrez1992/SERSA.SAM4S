import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, EntityManager } from 'typeorm';
import {
  EstadoDescarga,
  IDescarga
} from '../shared/types';
import { User } from '../users/entities/user.entity';
import { CompraPrepago } from '../users/entities/compra-prepago.entity';
import { Descarga } from './entities/descarga.entity';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { Certificado } from '../certificados/entities/certificado.entity';
import { TimezoneService } from '../common/timezone.service';
import {
  ForbiddenException,
  NotFoundException
} from '@nestjs/common';
interface RegistrarDescargaData {
  usuarioId: number;
  controladorId?: string;
  certificadoNombre: string;
  tamaño?: number;  
  ipOrigen?: string;
}

interface RegistrarErrorDescargaData {
  usuarioId: number;
  error: string;
  ipOrigen?: string;
}

interface ValidacionDescargaDto {
  canDownload: boolean;
  message: string;
  userType: 'CUENTA_CORRIENTE' | 'PREPAGO' | 'SIN_LIMITE';
  limiteDisponible: number;
  saldoPrepago?: number;
  saldoCuentaCorriente?: number;
  limiteCuentaCorriente?: number;
}

@Injectable()
export class DescargasService {
  private readonly logger = new Logger(DescargasService.name);
  constructor(
    @InjectRepository(Descarga)
    private descargaRepository: Repository<Descarga>,
    @InjectRepository(Certificado)
    private certificadoRepository: Repository<Certificado>,
    private auditoriaService: AuditoriaService,
    private timezoneService: TimezoneService,
  ) {
    this.logger.log('DescargasService initialized with PostgreSQL');
  }

  /**
   * Contar descargas pendientes de un usuario
   */
  async contarDescargasPendientes(usuarioId: number): Promise<number> {
    return await this.descargaRepository.count({
      where: { 
        id_usuario: usuarioId, 
        estadoMayorista: EstadoDescarga.PENDIENTE_FACTURAR 
      }
    });
  }
   /**
   * Contar descargas pendientes de un mayorista
   */
  async contarDescargasPendientesMayorista(mayoristaId: number): Promise<number> {
    // Buscar todos los usuarios que tienen ese id_mayorista
    const usuarios = await this.descargaRepository.manager.getRepository(User).find({
      where: { id_mayorista: mayoristaId },
      select: ['id_usuario']
    });
    const idsUsuarios = usuarios.map(u => u.id_usuario);
    if (idsUsuarios.length === 0) return 0;
    // Contar descargas pendientes de esos usuarios
    return await this.descargaRepository.count({
      where: {
        id_usuario: In(idsUsuarios),
        estadoMayorista: EstadoDescarga.PENDIENTE_FACTURAR
      }
    });
  }
  //** Obtener id_mayorista por id_usuario */
  async obtenerIdMayoristaPorUsuario(usuarioId: number): Promise<number> {
    const user = await this.descargaRepository.manager.getRepository(User).findOne({
      where: { id_usuario: usuarioId },
      select: ['id_mayorista']
    });
    return user?.id_mayorista || 0;
  }
  /**
   * Obtener el notification_limit del mayorista
   * Busca al usuario con rol=2 e id_mayorista = mayoristaId
   */
  async obtenerNotificationLimitMayorista(mayoristaId: number): Promise<number> {
    const mayorista = await this.descargaRepository.manager.getRepository(User).findOne({
      where: { 
        rol: 2,  // rol MAYORISTA
        id_mayorista: mayoristaId 
      },
      select: ['notification_limit']
    });
    
    // Si no existe el usuario mayorista o no tiene límite asignado, usar default 100
    if (!mayorista || mayorista.notification_limit === null || mayorista.notification_limit === undefined) {
      this.logger.warn(`No se encontró notification_limit para mayorista ${mayoristaId}, usando default 100`);
      return 100;
    }
    
    return mayorista.notification_limit;
  }

  /**
   * notificar al administrador que el mayorista supero el limite de descargas pendientes
   * Obtiene el notification_limit de la BD en lugar de una variable de sesión
   */
  async notificarExcesoDescargasMayorista(mayoristaId: number, totalPendientes: number): Promise<void> {
    this.logger.warn(`El mayorista ${mayoristaId} ha superado el límite de descargas pendientes: ${totalPendientes}`);
    // Obtener el notification_limit de la BD
    const notificationLimit = await this.obtenerNotificationLimitMayorista(mayoristaId);
    this.logger.warn(`Límite de notificación del mayorista ${mayoristaId}: ${notificationLimit}, Descargas pendientes: ${totalPendientes}`);
    // La notificación se envía vía mail
    await this.auditoriaService.notificarExcesoDescargas(mayoristaId, totalPendientes);
  }
  /**
   * Validar si un usuario puede descargar certificados
   * Admin (1) y Mayorista (2): siempre pueden
   * Distribuidor (3) y Facturación (4): deben validar según tipo_descarga
   * 
   * CUENTA_CORRIENTE: Validar descargas pendientes >= límite configurado
   * PREPAGO: Validar límite disponible > 0
   */
  async canUserDownload(userId: number): Promise<ValidacionDescargaDto> {
    const userRepository = this.descargaRepository.manager.getRepository(User);
    const user = await userRepository.findOne({ 
      where: { id_usuario: userId } 
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.status === 2) {
      throw new ForbiddenException('Tu cuenta está suspendida. Para más información contactá con tu proveedor.');
    }
    if (user.status === 3) {
      throw new ForbiddenException('Tu cuenta está inactiva. Para más información contactá con tu proveedor.');
    }

    // Si es distribuidor, verificar también el estado del mayorista asociado
    if (user.rol === 3 && user.id_mayorista) {
      const mayorista = await userRepository.findOne({
        where: { rol: 2, id_mayorista: user.id_mayorista },
        select: ['status', 'nombre']
      });
      if (mayorista && mayorista.status != null && mayorista.status !== 1) {
        throw new ForbiddenException('Las descargas están bloqueadas: el mayorista asociado tiene la cuenta suspendida.');
      }
    }

    // Admin (1): siempre puede descargar, sin ningún tipo de límite
    if (user.rol === 1) {
      return {
        canDownload: true,
        message: '',
        userType: 'SIN_LIMITE',
        limiteDisponible: -1
      };
    }

    // ⭐ Modelo híbrido: el saldo prepago (calculado en vivo desde compras_prepago,
    // no cacheado) se consume siempre primero, para cualquier rol.
    const saldoPrepago = await this.obtenerSaldoPrepago(userId, this.descargaRepository.manager);

    // Mayorista (2): no tiene límite de cuenta corriente. Si tiene saldo prepago se usa;
    // si no, queda sin límite (comportamiento histórico).
    if (user.rol === 2) {
      if (saldoPrepago > 0) {
        return {
          canDownload: true,
          message: '',
          userType: 'PREPAGO',
          limiteDisponible: saldoPrepago,
          saldoPrepago
        };
      }
      return {
        canDownload: true,
        message: '',
        userType: 'SIN_LIMITE',
        limiteDisponible: -1,
        saldoPrepago
      };
    }

    // Distribuidor (3), Facturación (4) u otros roles: calcular también el saldo de
    // cuenta corriente para poder informar ambos al usuario, aunque el prepago sea el que aplique.
    // Los distribuidores (rol 3) usan estadoDistribuidor, otros usan estadoMayorista.
    // Excepción SERSA: para distribuidores de mayorista=1, Facturado también bloquea
    // (solo libera en Cobrado/Garantia/Bonificado); para el resto, Facturado ya libera.
    let descargasPendientes: number;
    if (user.rol === 3) {
      const estadosQueBloquean = user.id_mayorista === 1
        ? [EstadoDescarga.PENDIENTE_FACTURAR, EstadoDescarga.FACTURADO]
        : [EstadoDescarga.PENDIENTE_FACTURAR];
      descargasPendientes = await this.descargaRepository.count({
        where: estadosQueBloquean.map(estado => ({ id_usuario: userId, estadoDistribuidor: estado }))
      });
      this.logger.log(`[canUserDownload] Distribuidor ${userId} (id_mayorista=${user.id_mayorista}), descargas pendientes: ${descargasPendientes}`);
    } else {
      descargasPendientes = await this.descargaRepository.count({
        where: [
          { id_usuario: userId, estadoMayorista: EstadoDescarga.PENDIENTE_FACTURAR },
          { id_usuario: userId, estadoMayorista: EstadoDescarga.FACTURADO }
        ]
      });
    }

    const limiteCuentaCorriente = user.limite_descargas;
    const saldoCuentaCorriente = limiteCuentaCorriente - descargasPendientes;

    if (saldoPrepago > 0) {
      return {
        canDownload: true,
        message: '',
        userType: 'PREPAGO',
        limiteDisponible: saldoPrepago,
        saldoPrepago,
        saldoCuentaCorriente,
        limiteCuentaCorriente
      };
    }

    if (descargasPendientes >= limiteCuentaCorriente) {
      return {
        canDownload: false,
        message: `Has alcanzado el límite de descargas pendientes (${descargasPendientes} de ${limiteCuentaCorriente}). No puedes descargar certificados hasta que se libere el límite.`,
        userType: 'CUENTA_CORRIENTE',
        limiteDisponible: saldoCuentaCorriente,
        saldoPrepago,
        saldoCuentaCorriente,
        limiteCuentaCorriente
      };
    }

    return {
      canDownload: true,
      message: '',
      userType: 'CUENTA_CORRIENTE',
      limiteDisponible: saldoCuentaCorriente,
      saldoPrepago,
      saldoCuentaCorriente,
      limiteCuentaCorriente
    };
  }
  /**
   * Registrar una nueva descarga exitosa
   * Incluye validación de límite y decremento automático para PREPAGO
   */
  async registrarDescarga(data: RegistrarDescargaData): Promise<IDescarga> {
    try {
      this.logger.log(`Registrando descarga para usuario ${data.usuarioId}`);
      
      // ⭐ Validar si el usuario puede descargar
      const validacion = await this.canUserDownload(data.usuarioId);
      if (!validacion.canDownload) {
        throw new ForbiddenException(validacion.message);
      }      // Obtener usuario
      const userRepository = this.descargaRepository.manager.getRepository(User);
      const user = await userRepository.findOne({
        where: { id_usuario: data.usuarioId }
      });

      // Usar fecha actual en zona horaria de Argentina (se almacena en UTC)
      const ahora = new Date();

      // ⭐ Modelo híbrido: intentar consumir crédito prepago (FIFO, con lock) sin importar
      // el tipo_descarga declarado del usuario; si no hay compra con saldo, cae a cuenta
      // corriente. La determinación de qué fuente se usó ocurre DENTRO de la transacción,
      // porque depende de si efectivamente se consiguió consumir una compra.
      let usoPrepagoFinal = false;
      const savedDescarga = await this.descargaRepository.manager.transaction(async manager => {
        const descargaRepo = manager.getRepository(Descarga);
        const compraRepo = manager.getRepository(CompraPrepago);

        let idCompraConsumida: number | null = null;
        const compra = await compraRepo
          .createQueryBuilder('c')
          .setLock('pessimistic_write')
          .where('c.id_usuario = :userId', { userId: data.usuarioId })
          .andWhere('c.cantidad > c.cantidad_usada')
          .orderBy('c.fecha_compra', 'ASC')
          .addOrderBy('c.id', 'ASC')
          .getOne();

        if (compra) {
          compra.cantidad_usada += 1;
          await compraRepo.save(compra);
          idCompraConsumida = compra.id;
        }

        const usoPrepago = idCompraConsumida !== null;
        usoPrepagoFinal = usoPrepago;

        // Determinar estado inicial según la fuente de crédito realmente usada por ESTA descarga
        let estadoMayoristaInicial: EstadoDescarga;
        let estadoDistribuidorInicial: EstadoDescarga;

        if (usoPrepago) {
          if (user.id_mayorista === 1) {
            // SERSA (mayorista = 1): Ambos PREPAGO (inmutables)
            estadoMayoristaInicial = EstadoDescarga.PREPAGO;
            estadoDistribuidorInicial = EstadoDescarga.PREPAGO;
            this.logger.log(`[registrarDescarga] Prepago de SERSA: Ambos estados = PREPAGO`);
          } else {
            // Otro mayorista: Distribuidor PREPAGO (inmutable), Mayorista PENDIENTE (mutable)
            estadoMayoristaInicial = EstadoDescarga.PENDIENTE_FACTURAR;
            estadoDistribuidorInicial = EstadoDescarga.PREPAGO;
            this.logger.log(
              `[registrarDescarga] Prepago de mayorista ${user.id_mayorista}: ` +
              `Mayorista=PENDIENTE (mutable), Distribuidor=PREPAGO (inmutable)`
            );
          }
        } else {
          // Sin saldo prepago: cae a cuenta corriente. Defensa ante condiciones de carrera:
          // reconfirmar que sigue habiendo cupo de cuenta corriente en este momento.
          const estadoField = user.rol === 3 ? 'estadoDistribuidor' : 'estadoMayorista';
          const estadosQueBloquean = user.rol === 3 && user.id_mayorista !== 1
            ? [EstadoDescarga.PENDIENTE_FACTURAR]
            : [EstadoDescarga.PENDIENTE_FACTURAR, EstadoDescarga.FACTURADO];
          const descargasPendientes = await manager.getRepository(Descarga).count({
            where: estadosQueBloquean.map(estado => ({ id_usuario: data.usuarioId, [estadoField]: estado }))
          });
          if (user.rol !== 1 && user.rol !== 2 && descargasPendientes >= user.limite_descargas) {
            throw new ForbiddenException('Has alcanzado el límite de descargas pendientes. No podés descargar hasta que se libere el límite.');
          }

          estadoMayoristaInicial = EstadoDescarga.PENDIENTE_FACTURAR;
          estadoDistribuidorInicial = EstadoDescarga.PENDIENTE_FACTURAR;
          this.logger.log(`[registrarDescarga] Cuenta corriente: Ambos estados = PENDIENTE`);
        }

        const descarga = descargaRepo.create({
          id_usuario: data.usuarioId,
          id_certificado: data.controladorId,
          certificado_nombre: data.certificadoNombre,
          tipo_descarga: usoPrepago ? 'PREPAGO' : 'CUENTA_CORRIENTE', // ⭐ Fuente real de crédito de ESTA descarga
          estadoMayorista: estadoMayoristaInicial,
          estadoDistribuidor: estadoDistribuidorInicial,
          tamaño: data.tamaño,
          id_compra_prepago: idCompraConsumida,
          updated_at: ahora.toISOString(),
          created_at: ahora.toISOString()
        });

        return await descargaRepo.save(descarga);
      });

      // Registrar en auditoría
      await this.auditoriaService.log(
        data.usuarioId,
        'DOWNLOAD' as any,
        'CERTIFICADO' as any,
        savedDescarga.id_descarga as any,
        null,
        {
          certificado: data.certificadoNombre,
          tipo_descarga: usoPrepagoFinal ? 'PREPAGO' : 'CUENTA_CORRIENTE'
        },
        data.ipOrigen
      );

      this.logger.log(`Descarga registrada con ID: ${savedDescarga.id_descarga}`);

      // Convertir a formato IDescarga
      return this.convertToIDescarga(savedDescarga);

    } catch (error) {
      this.logger.error('Error registrando descarga:', error.message);
      throw error;
    }
  }
  /**
   * Convertir entidad Descarga a IDescarga
   */  private convertToIDescarga(descarga: Descarga): IDescarga {
    return {
      id: descarga.id_descarga,
      usuarioId: descarga.id_usuario,
      controladorId: descarga.id_certificado,
      certificadoNombre: descarga.certificado_nombre,
      estadoMayorista: descarga.estadoMayorista as EstadoDescarga,
      estadoDistribuidor: descarga.estadoDistribuidor as EstadoDescarga,
      createdAt: descarga.created_at,
      updatedAt: descarga.updated_at,
      fechaFacturacion: descarga.fecha_facturacion,
      tamaño: descarga.tamaño,
      tipoDescarga: descarga.tipo_descarga,
      numero_factura: descarga.numero_factura,
      referencia_pago: descarga.referencia_pago,
      numero_factura_distribuidor: descarga.numero_factura_distribuidor,
      referencia_pago_distribuidor: descarga.referencia_pago_distribuidor,
      numeroFacturaCompraPrepago: descarga.compraPrepago?.numero_factura ?? null,
      usuario: descarga.usuario
        ? {
            nombre: descarga.usuario.nombre,
            cuit: descarga.usuario.cuit,
            mail: descarga.usuario.mail,
            idrol: descarga.usuario.rol,
            id_mayorista: descarga.usuario.id_mayorista
          }
        : undefined
    };
  }

  /**
   * Calcular (sin persistir) el saldo prepago disponible de un usuario,
   * como suma de saldos (cantidad - cantidad_usada) de sus compras_prepago.
   * A diferencia del diseño anterior, esto NO se cachea en users.limite_descargas
   * (esa columna ahora es exclusivamente el límite de cuenta corriente).
   */
  private async obtenerSaldoPrepago(userId: number, manager: EntityManager): Promise<number> {
    const compraRepo = manager.getRepository(CompraPrepago);
    const { sum } = await compraRepo
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.cantidad - c.cantidad_usada), 0)', 'sum')
      .where('c.id_usuario = :userId', { userId })
      .getRawOne();
    return Number(sum);
  }

  /**
   * Registrar error de descarga para auditoría
   */
  async registrarErrorDescarga(data: RegistrarErrorDescargaData): Promise<void> {
    try {
      this.logger.log(`Registrando error de descarga para usuario ${data.usuarioId}`);

      await this.auditoriaService.log(
        data.usuarioId,
        'ERROR' as any,
        'CERTIFICADO' as any,
        null,
        null,
        {
          error: data.error
        },
        data.ipOrigen
      );

    } catch (error) {
      this.logger.error('Error registrando error de descarga:', error.message);
    }
  }
  /**
   * Obtener certificado PEM por ID de descarga
   */
  async getCertificadoPem(descargaId: string | number, userId: number, userRole: number): Promise<{
    content: string;
    filename: string;
    contentType: string;
  }> {

    //Verificar que la descarga exista
    const descarga = await this.descargaRepository.findOne({
      where: { id_descarga: String(descargaId) }
    });

    if (!descarga) {
      throw new Error('Descarga no encontrada');
    }

    // Verificar permisos
    if (userRole === 3 && descarga.id_usuario !== userId) {
      throw new Error('No tiene permisos para acceder a esta descarga');
    }
    //con el id de la descarga obtener el certificado de la tabla certificados_v2
    const certificado = await this.certificadoRepository.findOne({
      where: { id_certificado: String(descarga.id_certificado) }
    });

    if (!certificado) {
      throw new Error('Certificado no encontrado');
    }

    return {
      //TODO- Corregir, el content tiene que ser el metadata del certificado
      content: certificado.metadata,
      filename: descarga.certificado_nombre,
      contentType: 'application/x-pem-file'
    };
  }
  /**
   * Cambiar estado de descarga
   */  async updateEstadoDescarga(
    descargaId: string | number,
    nuevoEstado: {
      estadoMayorista?: EstadoDescarga;
      estadoDistribuidor?: EstadoDescarga;
      numero_factura?: string;
      referencia_pago?: string;
      numero_factura_distribuidor?: string;
      referencia_pago_distribuidor?: string;
    },
    userId: number,
    userRole: number,
    fechaFacturacion: Date,
    ip?: string
  ): Promise<IDescarga> {
    
    const descarga = await this.descargaRepository.findOne({
      where: { id_descarga: String(descargaId) }
    });    
    if (!descarga) {
      throw new Error('Descarga no encontrada');
    }    const idMayorista = await this.obtenerIdMayoristaPorUsuario(descarga.id_usuario);

    // ⭐ NUEVA LÓGICA: Validar permisos según rol
    // Distribuidor (3) y Técnico (5) nunca pueden cambiar estados
    if (userRole === 3 || userRole === 5) {
      const rolName = userRole === 3 ? 'Distribuidores' : 'Técnicos';
      throw new ForbiddenException(`${rolName} no pueden cambiar estados de descargas`);
    }

    // Mayorista (2): solo puede modificar descargas de sus propios distribuidores (mismo id_mayorista)
    if (userRole === 2) {
      const idMayoristaLogueado = await this.obtenerIdMayoristaPorUsuario(userId);
      if (idMayoristaLogueado !== idMayorista) {
        throw new ForbiddenException('No podés modificar descargas de distribuidores que no son tuyos');
      }
    }

    // Estados que liberan deuda (garantia/bonificado): permiten modificar incluso PREPAGO SERSA
    const esEstadoLibreDeuda = nuevoEstado.estadoMayorista === EstadoDescarga.GARANTIA
      || nuevoEstado.estadoMayorista === EstadoDescarga.BONIFICADO
      || nuevoEstado.estadoDistribuidor === EstadoDescarga.GARANTIA
      || nuevoEstado.estadoDistribuidor === EstadoDescarga.BONIFICADO;

    // ⭐ NUEVA LÓGICA: Bloqueo selectivo de PREPAGO
    // Caso 1: PREPAGO de SERSA (mayorista = 1) - Bloquear AMBOS estados (excepto Garantia/Bonificado)
    if (descarga.tipo_descarga === 'PREPAGO' && idMayorista === 1 && !esEstadoLibreDeuda) {
      throw new ForbiddenException(
        'No se puede modificar estados de descargas PREPAGO de SERSA. El estado PREPAGO es definitivo e inmutable.'
      );
    }

    // Caso 2: PREPAGO de otro mayorista - Bloquear solo estadoDistribuidor
    if (descarga.tipo_descarga === 'PREPAGO' && idMayorista !== 1) {
      if (nuevoEstado.estadoDistribuidor !== undefined && 
          nuevoEstado.estadoDistribuidor !== EstadoDescarga.PREPAGO) {
        throw new ForbiddenException(
          'No se puede cambiar estadoDistribuidor. El estado PREPAGO en el distribuidor es definitivo e inmutable. Solo el estadoMayorista puede modificarse.'
        );
      }
    }

    const estadoAnterior = {
      estadoMayorista: descarga.estadoMayorista,
      estadoDistribuidor: descarga.estadoDistribuidor,
      numero_factura: descarga.numero_factura,
      referencia_pago: descarga.referencia_pago,
      numero_factura_distribuidor: descarga.numero_factura_distribuidor,
      referencia_pago_distribuidor: descarga.referencia_pago_distribuidor
    };

    // El estado ya estaba libre de deuda antes de este cambio (evita re-acreditar
    // crédito si se re-guarda el mismo estado Garantia/Bonificado dos veces)
    const yaEstabaLibreDeuda =
      estadoAnterior.estadoMayorista === EstadoDescarga.GARANTIA ||
      estadoAnterior.estadoMayorista === EstadoDescarga.BONIFICADO ||
      estadoAnterior.estadoDistribuidor === EstadoDescarga.GARANTIA ||
      estadoAnterior.estadoDistribuidor === EstadoDescarga.BONIFICADO;

    this.logger.log(`[updateEstadoDescarga] Usuario ${userId} (rol ${userRole}) intenta cambiar estados`);
    this.logger.log(`[updateEstadoDescarga] Descarga ${descargaId}: tipo=${descarga.tipo_descarga}, mayorista=${idMayorista}`);
    this.logger.log(`[updateEstadoDescarga] Estado anterior:`, estadoAnterior);
    this.logger.log(`[updateEstadoDescarga] Nuevo estadoMayorista solicitado:`, nuevoEstado.estadoMayorista);
    this.logger.log(`[updateEstadoDescarga] Nuevo estadoDistribuidor solicitado:`, nuevoEstado.estadoDistribuidor);

    // ⭐ NUEVA LÓGICA: Determinar qué estados puede cambiar el usuario
    // Admin (1) y Facturación (4): Pueden cambiar estadoMayorista
    if (userRole === 1 || userRole === 4) {
      if (nuevoEstado.estadoMayorista !== undefined) {
        descarga.estadoMayorista = nuevoEstado.estadoMayorista;
        this.logger.log(`[updateEstadoDescarga] Admin/Facturación cambió estadoMayorista`);
      }
      //Si es distribuidor de SERSA (id_mayorista = 1), puede cambiar tambien estadoDistribuidor con el mismo valor del estado mayorista
      if (idMayorista === 1  ) {
        descarga.estadoDistribuidor = nuevoEstado.estadoMayorista;
        this.logger.log(`[updateEstadoDescarga] Admin/Facturación cambió estadoDistribuidor (SERSA)`);

        // Espejar también el número de factura/referencia de pago hacia los campos del distribuidor
        if (nuevoEstado.estadoMayorista === EstadoDescarga.FACTURADO) {
          descarga.numero_factura_distribuidor = nuevoEstado.numero_factura || descarga.numero_factura_distribuidor;
        } else if (nuevoEstado.estadoMayorista === EstadoDescarga.PENDIENTE_FACTURAR) {
          descarga.numero_factura_distribuidor = null;
          descarga.referencia_pago_distribuidor = null;
        }

        if (nuevoEstado.estadoMayorista === EstadoDescarga.COBRADO) {
          descarga.referencia_pago_distribuidor = nuevoEstado.referencia_pago || descarga.referencia_pago_distribuidor;
        } else if (nuevoEstado.estadoMayorista === EstadoDescarga.FACTURADO) {
          descarga.referencia_pago_distribuidor = null;
        }
      }
    }
    // Mayorista (2): Puede cambiar estadoDistribuidor de sus distribuidores con los 5 estados
    else if (userRole === 2 && nuevoEstado.estadoDistribuidor !== undefined) {
      descarga.estadoDistribuidor = nuevoEstado.estadoDistribuidor;
      this.logger.log(`[updateEstadoDescarga] Mayorista cambió estadoDistribuidor a ${nuevoEstado.estadoDistribuidor}`);
    }

    // Manejar número de factura del mayorista (solo para estado Facturado)
    if (nuevoEstado.estadoMayorista === EstadoDescarga.FACTURADO) {
      descarga.numero_factura = nuevoEstado.numero_factura || descarga.numero_factura;
    } else if (nuevoEstado.estadoMayorista === EstadoDescarga.PENDIENTE_FACTURAR) {
      // Si retrocede a Pendiente, limpiar ambos
      descarga.numero_factura = null;
      descarga.referencia_pago = null;
    }

    // Manejar referencia de pago del mayorista (solo para estado Cobrado)
    if (nuevoEstado.estadoMayorista === EstadoDescarga.COBRADO) {
      descarga.referencia_pago = nuevoEstado.referencia_pago || descarga.referencia_pago;
    } else if (nuevoEstado.estadoMayorista === EstadoDescarga.FACTURADO) {
      // Si retrocede de Cobrado a Facturado, limpiar solo referencia_pago
      descarga.referencia_pago = null;
    }

    // Manejar número de factura del distribuidor (solo cuando lo cambia el Mayorista, estado Facturado)
    if (userRole === 2) {
      if (nuevoEstado.estadoDistribuidor === EstadoDescarga.FACTURADO) {
        descarga.numero_factura_distribuidor = nuevoEstado.numero_factura_distribuidor || descarga.numero_factura_distribuidor;
      } else if (nuevoEstado.estadoDistribuidor === EstadoDescarga.PENDIENTE_FACTURAR) {
        // Si retrocede a Pendiente, limpiar ambos
        descarga.numero_factura_distribuidor = null;
        descarga.referencia_pago_distribuidor = null;
      }

      // Manejar referencia de pago del distribuidor (solo para estado Cobrado)
      if (nuevoEstado.estadoDistribuidor === EstadoDescarga.COBRADO) {
        descarga.referencia_pago_distribuidor = nuevoEstado.referencia_pago_distribuidor || descarga.referencia_pago_distribuidor;
      } else if (nuevoEstado.estadoDistribuidor === EstadoDescarga.FACTURADO) {
        // Si retrocede de Cobrado a Facturado, limpiar solo referencia_pago
        descarga.referencia_pago_distribuidor = null;
      }
    }

    // Actualizar fecha de facturación si se proporciona
    if (fechaFacturacion && nuevoEstado.estadoMayorista === EstadoDescarga.FACTURADO) {
      descarga.fecha_facturacion = fechaFacturacion;
    }

    // Guardar cambios
    const updatedDescarga = await this.descargaRepository.save(descarga);

    // Restaurar crédito para usuarios PREPAGO cuando se marca Garantia o Bonificado
    // (solo si no estaba ya en un estado libre de deuda, para no acreditar dos veces)
    const debeRestaurarCredito = esEstadoLibreDeuda && !yaEstabaLibreDeuda && descarga.tipo_descarga === 'PREPAGO';
    if (debeRestaurarCredito) {
      await this.descargaRepository.manager.transaction(async manager => {
        if (descarga.id_compra_prepago) {
          const compraRepo = manager.getRepository(CompraPrepago);
          const compra = await compraRepo
            .createQueryBuilder('c')
            .setLock('pessimistic_write')
            .where('c.id = :id', { id: descarga.id_compra_prepago })
            .getOne();

          if (compra) {
            if (compra.cantidad_usada <= 0) {
              this.logger.warn(`[updateEstadoDescarga] Compra ${compra.id} ya tenía cantidad_usada en 0 al restaurar crédito de descarga ${descarga.id_descarga}`);
            }
            compra.cantidad_usada = Math.max(0, compra.cantidad_usada - 1);
            await compraRepo.save(compra);
          } else {
            this.logger.warn(`[updateEstadoDescarga] Compra ${descarga.id_compra_prepago} no encontrada al restaurar crédito de descarga ${descarga.id_descarga}`);
          }
        } else {
          // Descarga histórica anterior a esta feature: no sabemos qué compra acreditar.
          // No hay ningún campo que restaurar automáticamente (limite_descargas ya no
          // representa saldo prepago); requiere ajuste manual si corresponde.
          this.logger.warn(`[updateEstadoDescarga] Descarga ${descarga.id_descarga} sin id_compra_prepago — no se pudo restaurar crédito automáticamente`);
        }
      });
      this.logger.log(`[updateEstadoDescarga] Crédito PREPAGO restaurado para usuario ${descarga.id_usuario} (estado: ${nuevoEstado.estadoMayorista || nuevoEstado.estadoDistribuidor})`);
    }

    // Registrar en auditoría
    await this.auditoriaService.log(
      userId,
      'UPDATE' as any,
      'DESCARGA' as any,
      descargaId as any,
      estadoAnterior,
      {
        estadoMayorista: updatedDescarga.estadoMayorista,
        estadoDistribuidor: updatedDescarga.estadoDistribuidor,
        numero_factura: updatedDescarga.numero_factura,
        referencia_pago: updatedDescarga.referencia_pago,
        numero_factura_distribuidor: updatedDescarga.numero_factura_distribuidor,
        referencia_pago_distribuidor: updatedDescarga.referencia_pago_distribuidor
      },
      ip
    );

    return this.convertToIDescarga(updatedDescarga);
  }
  /**
   * Obtener historial de descargas con filtros
   */  async getDescargas(params: any): Promise<{ descargas: IDescarga[]; total: number }> {
    const {
      page = 1,
      limit = 50,
      usuarioId,
      cuit,
      nombre,
      idMayorista,
      fechaDesde,
      fechaHasta,
      mes,
      anio,
      controladorId,
      estadoDistribuidor,
      estadoMayorista,
      marca,
      numeroFactura,
      userRole // ⭐ NUEVO: Rol del usuario para filtrado inteligente
    } = params;    this.logger.log(`[getDescargas] Parámetros recibidos:`, params);
    this.logger.log(`[getDescargas] usuarioId: ${usuarioId} (tipo: ${typeof usuarioId})`);
    this.logger.log(`[getDescargas] idMayorista: ${idMayorista} (tipo: ${typeof idMayorista})`);
    this.logger.log(`[getDescargas] userRole: ${userRole}`);
    this.logger.log(`[getDescargas] estadoMayorista: ${estadoMayorista}`);
    this.logger.log(`[getDescargas] estadoDistribuidor: ${estadoDistribuidor}`);
    this.logger.log(`[getDescargas] cuit: ${cuit}`);

    const query = this.descargaRepository.createQueryBuilder('descarga')
      .leftJoinAndSelect('descarga.usuario', 'usuario')
      .leftJoinAndSelect('descarga.compraPrepago', 'compraPrepago')
      .where('1=1');

    if (usuarioId) {
      const usuarioIdNum = typeof usuarioId === 'string' ? parseInt(usuarioId, 10) : usuarioId;
      this.logger.log(`[getDescargas] Filtrando por usuarioId: ${usuarioIdNum}`);
      query.andWhere('descarga.id_usuario = :usuarioId', { usuarioId: usuarioIdNum });
    }
    if (cuit) {
      this.logger.log(`[getDescargas] Filtrando por cuit: ${cuit}`);
      query.andWhere('usuario.cuit LIKE :cuit', { cuit: `${cuit}%` });
    }
    if (nombre) {
      this.logger.log(`[getDescargas] Filtrando por nombre: ${nombre}`);
      query.andWhere('usuario.nombre ILIKE :nombre', { nombre: `%${nombre}%` });
    }
    if (idMayorista) {
      const idMayoristaNum = typeof idMayorista === 'string' ? parseInt(idMayorista, 10) : idMayorista;
      this.logger.log(`[getDescargas] Filtrando por idMayorista: ${idMayoristaNum}`);
      query.andWhere('usuario.id_mayorista = :idMayorista', { idMayorista: idMayoristaNum });
    }
    
    // Filtros de fecha usando zona horaria de Argentina
    if (fechaDesde) {
      query.andWhere('(descarga.created_at AT TIME ZONE \'America/Argentina/Buenos_Aires\')::date >= :fechaDesde', { fechaDesde });
    }
    if (fechaHasta) {
      query.andWhere('(descarga.created_at AT TIME ZONE \'America/Argentina/Buenos_Aires\')::date <= :fechaHasta', { fechaHasta });
    }
    if (mes) {
      const mesNum = typeof mes === 'string' ? parseInt(mes, 10) : mes;
      query.andWhere('EXTRACT(MONTH FROM descarga.created_at AT TIME ZONE \'America/Argentina/Buenos_Aires\') = :mes', { mes: mesNum });
    } 
    if(anio) {
      const anioNum = typeof anio === 'string' ? parseInt(anio, 10) : anio;
      query.andWhere('EXTRACT(YEAR FROM descarga.created_at AT TIME ZONE \'America/Argentina/Buenos_Aires\') = :anio', { anio: anioNum });
    }    if (controladorId) {
      query.andWhere('descarga.id_certificado ILIKE :controladorId', { controladorId: `%${controladorId}%` });
    }
      // ⭐ FILTRADO DE ESTADOS - Lógica flexible
    // Ambos estados pueden filtrarse independientemente según el parámetro explícito
    if (estadoMayorista) {
      this.logger.log(`[getDescargas] Filtrando por estadoMayorista: ${estadoMayorista}`);
      query.andWhere('descarga.estadoMayorista = :estadoMayorista', { estadoMayorista });
    }
    if (estadoDistribuidor) {
      this.logger.log(`[getDescargas] Filtrando por estadoDistribuidor: ${estadoDistribuidor}`);
      query.andWhere('descarga.estadoDistribuidor = :estadoDistribuidor', { estadoDistribuidor });
    }
    
    if (marca) {
      query.andWhere('descarga.marca = :marca', { marca });
    }
    if (numeroFactura) {
      query.andWhere('descarga.numero_factura ILIKE :numeroFactura', { numeroFactura: `%${numeroFactura}%` });
    }

    this.logger.log(`[getDescargas] Query construida, ejecutando... page: ${page}, limit: ${limit}`);
    
    const [descargas, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('descarga.created_at', 'DESC')
      .getManyAndCount();

    this.logger.log(`[getDescargas] Resultado: ${total} descargas encontradas, retornando ${descargas.length}`);
    if (descargas.length > 0) {
      this.logger.log(`[getDescargas] Primera descarga:`, descargas[0]);
    }

    return { descargas: descargas.map(d => this.convertToIDescarga(d)), total };
  }
}