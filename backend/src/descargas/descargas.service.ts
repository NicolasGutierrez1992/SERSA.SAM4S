import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, EntityManager, SelectQueryBuilder } from 'typeorm';
import { EstadoDescarga, IDescarga } from '../shared/types';
import { User } from '../users/entities/user.entity';
import { CompraPrepago } from '../users/entities/compra-prepago.entity';
import { Descarga } from './entities/descarga.entity';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { Certificado } from '../certificados/entities/certificado.entity';
import { TimezoneService } from '../common/timezone.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BucketFactura, ResumenFacturaDto } from './dto/resumen-factura.dto';
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
  yaDescargado?: boolean;
  fechaUltimaDescarga?: Date;
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
        estadoMayorista: EstadoDescarga.PENDIENTE_FACTURAR,
      },
    });
  }
  /**
   * Contar descargas pendientes de un mayorista
   */
  async contarDescargasPendientesMayorista(
    mayoristaId: number,
  ): Promise<number> {
    // Buscar todos los usuarios que tienen ese id_mayorista
    const usuarios = await this.descargaRepository.manager
      .getRepository(User)
      .find({
        where: { id_mayorista: mayoristaId },
        select: ['id_usuario'],
      });
    const idsUsuarios = usuarios.map((u) => u.id_usuario);
    if (idsUsuarios.length === 0) return 0;
    // Contar descargas pendientes de esos usuarios
    return await this.descargaRepository.count({
      where: {
        id_usuario: In(idsUsuarios),
        estadoMayorista: EstadoDescarga.PENDIENTE_FACTURAR,
      },
    });
  }
  //** Obtener id_mayorista por id_usuario */
  async obtenerIdMayoristaPorUsuario(usuarioId: number): Promise<number> {
    const user = await this.descargaRepository.manager
      .getRepository(User)
      .findOne({
        where: { id_usuario: usuarioId },
        select: ['id_mayorista'],
      });
    return user?.id_mayorista || 0;
  }

  /**
   * Resuelve el id_usuario del User rol=2 (Mayorista) dueño de un id_mayorista dado.
   * Se usa para ubicar el pool de compras_prepago del Mayorista al procesar descargas
   * o restauraciones de crédito de sus Distribuidores (id_mayorista !== 1).
   */
  async resolverIdUsuarioMayorista(
    idMayorista: number,
    manager?: EntityManager,
  ): Promise<number | null> {
    const repo = (manager ?? this.descargaRepository.manager).getRepository(
      User,
    );
    const mayorista = await repo.findOne({
      where: { rol: 2, id_mayorista: idMayorista },
      select: ['id_usuario'],
    });
    return mayorista?.id_usuario ?? null;
  }
  /**
   * Obtener el notification_limit del mayorista
   * Busca al usuario con rol=2 e id_mayorista = mayoristaId
   */
  async obtenerNotificationLimitMayorista(
    mayoristaId: number,
  ): Promise<number> {
    const mayorista = await this.descargaRepository.manager
      .getRepository(User)
      .findOne({
        where: {
          rol: 2, // rol MAYORISTA
          id_mayorista: mayoristaId,
        },
        select: ['notification_limit'],
      });

    // Si no existe el usuario mayorista o no tiene límite asignado, usar default 100
    if (
      !mayorista ||
      mayorista.notification_limit === null ||
      mayorista.notification_limit === undefined
    ) {
      this.logger.warn(
        `No se encontró notification_limit para mayorista ${mayoristaId}, usando default 100`,
      );
      return 100;
    }

    return mayorista.notification_limit;
  }

  /**
   * notificar al administrador que el mayorista supero el limite de descargas pendientes
   * Obtiene el notification_limit de la BD en lugar de una variable de sesión
   */
  async notificarExcesoDescargasMayorista(
    mayoristaId: number,
    totalPendientes: number,
  ): Promise<void> {
    this.logger.warn(
      `El mayorista ${mayoristaId} ha superado el límite de descargas pendientes: ${totalPendientes}`,
    );
    // Obtener el notification_limit de la BD
    const notificationLimit =
      await this.obtenerNotificationLimitMayorista(mayoristaId);
    this.logger.warn(
      `Límite de notificación del mayorista ${mayoristaId}: ${notificationLimit}, Descargas pendientes: ${totalPendientes}`,
    );
    // La notificación se envía vía mail
    await this.auditoriaService.notificarExcesoDescargas(
      mayoristaId,
      totalPendientes,
    );
  }

  /**
   * Obtener el notification_limit_prepago del mayorista (umbral de saldo
   * prepago bajo). Busca al usuario con rol=2 e id_mayorista = mayoristaId.
   */
  async obtenerNotificationLimitPrepagoMayorista(
    mayoristaId: number,
  ): Promise<number> {
    const mayorista = await this.descargaRepository.manager
      .getRepository(User)
      .findOne({
        where: {
          rol: 2, // rol MAYORISTA
          id_mayorista: mayoristaId,
        },
        select: ['notification_limit_prepago'],
      });

    if (
      !mayorista ||
      mayorista.notification_limit_prepago === null ||
      mayorista.notification_limit_prepago === undefined
    ) {
      this.logger.warn(
        `No se encontró notification_limit_prepago para mayorista ${mayoristaId}, usando default 10`,
      );
      return 10;
    }

    return mayorista.notification_limit_prepago;
  }

  /**
   * Saldo prepago total del Mayorista (rol=2, dueño de mayoristaId), sumando
   * todas sus compras_prepago. Envoltorio público de obtenerSaldoPrepago para
   * uso fuera de este servicio (ej. el chequeo de saldo bajo).
   */
  async obtenerSaldoPrepagoMayorista(mayoristaId: number): Promise<number> {
    const idUsuarioMayorista =
      await this.resolverIdUsuarioMayorista(mayoristaId);
    if (!idUsuarioMayorista) {
      this.logger.warn(
        `No se encontró usuario Mayorista para id_mayorista ${mayoristaId} al calcular saldo prepago`,
      );
      return 0;
    }
    return this.obtenerSaldoPrepago(
      idUsuarioMayorista,
      this.descargaRepository.manager,
    );
  }

  /**
   * Si el saldo prepago del Mayorista quedó por debajo de su umbral
   * configurado (notification_limit_prepago), dispara el mail de aviso a
   * facturación/administración. Sin cooldown: se llama una vez por cada
   * descarga que consumió saldo de este mayorista (ver registrarDescarga) —
   * mismo criterio "sin filtro" que notificarExcesoDescargasMayorista.
   */
  private async chequearYNotificarSaldoPrepagoBajo(
    mayoristaId: number,
  ): Promise<void> {
    const [saldo, umbral] = await Promise.all([
      this.obtenerSaldoPrepagoMayorista(mayoristaId),
      this.obtenerNotificationLimitPrepagoMayorista(mayoristaId),
    ]);

    if (saldo >= umbral) {
      return;
    }

    this.logger.warn(
      `Saldo prepago del mayorista ${mayoristaId} por debajo del umbral: saldo=${saldo}, umbral=${umbral}`,
    );

    const mayoristaMap = await this.resolverNombresMayoristaBatch(
      [mayoristaId],
      this.descargaRepository.manager,
    );
    const nombreMayorista =
      this.resolverNombreMayoristaDeMapa(mayoristaId, mayoristaMap) ??
      `Mayorista ${mayoristaId}`;

    await this.auditoriaService.notificarSaldoPrepagoBajo(
      mayoristaId,
      nombreMayorista,
      saldo,
      umbral,
    );
  }
  /**
   * Verificar si este usuario ya descargó este certificado antes.
   * Chequeo por usuario+certificado (no global): que otro usuario haya
   * descargado el mismo certificado es un caso legítimo y no debe avisar.
   */
  async yaDescargoCertificado(
    userId: number,
    idCertificado: string,
  ): Promise<{ yaDescargado: boolean; fechaUltimaDescarga?: Date }> {
    const ultimaDescarga = await this.descargaRepository.findOne({
      where: { id_usuario: userId, id_certificado: idCertificado },
      order: { created_at: 'DESC' },
    });

    if (!ultimaDescarga) {
      return { yaDescargado: false };
    }

    return {
      yaDescargado: true,
      fechaUltimaDescarga: ultimaDescarga.created_at,
    };
  }

  /**
   * Validar si un usuario puede descargar certificados
   * Admin (1), Mayorista (2) y Técnico (5): siempre pueden
   * Distribuidor (3) y Facturación (4): deben validar según tipo_descarga
   *
   * CUENTA_CORRIENTE: Validar descargas pendientes >= límite configurado
   * PREPAGO: Validar límite disponible > 0
   */
  async canUserDownload(userId: number): Promise<ValidacionDescargaDto> {
    const userRepository = this.descargaRepository.manager.getRepository(User);
    const user = await userRepository.findOne({
      where: { id_usuario: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.status === 2) {
      throw new ForbiddenException(
        'Tu cuenta está suspendida. Para más información contactá con tu proveedor.',
      );
    }
    if (user.status === 3) {
      throw new ForbiddenException(
        'Tu cuenta está inactiva. Para más información contactá con tu proveedor.',
      );
    }

    // Si es distribuidor, verificar también el estado del mayorista asociado
    if (user.rol === 3 && user.id_mayorista) {
      const mayorista = await userRepository.findOne({
        where: { rol: 2, id_mayorista: user.id_mayorista },
        select: ['status', 'nombre'],
      });
      if (mayorista && mayorista.status != null && mayorista.status !== 1) {
        throw new ForbiddenException(
          'Las descargas están bloqueadas: el mayorista asociado tiene la cuenta suspendida.',
        );
      }
    }

    // Admin (1): siempre puede descargar, sin ningún tipo de límite
    if (user.rol === 1) {
      return {
        canDownload: true,
        message: '',
        userType: 'SIN_LIMITE',
        limiteDisponible: -1,
      };
    }

    // ⭐ Modelo híbrido: el saldo prepago (calculado en vivo desde compras_prepago,
    // no cacheado) se consume siempre primero, para cualquier rol.
    const saldoPrepago = await this.obtenerSaldoPrepago(
      userId,
      this.descargaRepository.manager,
    );

    // Mayorista (2): no tiene límite de cuenta corriente. Si tiene saldo prepago se usa;
    // si no, queda sin límite (comportamiento histórico).
    if (user.rol === 2) {
      if (saldoPrepago > 0) {
        return {
          canDownload: true,
          message: '',
          userType: 'PREPAGO',
          limiteDisponible: saldoPrepago,
          saldoPrepago,
        };
      }
      return {
        canDownload: true,
        message: '',
        userType: 'SIN_LIMITE',
        limiteDisponible: -1,
        saldoPrepago,
      };
    }

    // Técnico (5): personal interno de SERSA (siempre id_mayorista = 1), sin límite de cuenta corriente
    if (user.rol === 5) {
      return {
        canDownload: true,
        message: '',
        userType: 'SIN_LIMITE',
        limiteDisponible: -1,
        saldoPrepago,
      };
    }

    // Distribuidor (3), Facturación (4): calcular también el saldo de
    // cuenta corriente para poder informar ambos al usuario, aunque el prepago sea el que aplique.
    // Los distribuidores (rol 3) usan estadoDistribuidor, otros usan estadoMayorista.
    // Excepción SERSA: para distribuidores de mayorista=1, Facturado también bloquea
    // (solo libera en Cobrado/Garantia/Bonificado); para el resto, Facturado ya libera.
    let descargasPendientes: number;
    if (user.rol === 3) {
      const estadosQueBloquean =
        user.id_mayorista === 1
          ? [EstadoDescarga.PENDIENTE_FACTURAR, EstadoDescarga.FACTURADO]
          : [EstadoDescarga.PENDIENTE_FACTURAR];
      descargasPendientes = await this.descargaRepository.count({
        where: estadosQueBloquean.map((estado) => ({
          id_usuario: userId,
          estadoDistribuidor: estado,
        })),
      });
      this.logger.log(
        `[canUserDownload] Distribuidor ${userId} (id_mayorista=${user.id_mayorista}), descargas pendientes: ${descargasPendientes}`,
      );
    } else {
      descargasPendientes = await this.descargaRepository.count({
        where: [
          {
            id_usuario: userId,
            estadoMayorista: EstadoDescarga.PENDIENTE_FACTURAR,
          },
          { id_usuario: userId, estadoMayorista: EstadoDescarga.FACTURADO },
        ],
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
        limiteCuentaCorriente,
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
        limiteCuentaCorriente,
      };
    }

    return {
      canDownload: true,
      message: '',
      userType: 'CUENTA_CORRIENTE',
      limiteDisponible: saldoCuentaCorriente,
      saldoPrepago,
      saldoCuentaCorriente,
      limiteCuentaCorriente,
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
      } // Obtener usuario
      const userRepository =
        this.descargaRepository.manager.getRepository(User);
      const user = await userRepository.findOne({
        where: { id_usuario: data.usuarioId },
      });

      // Usar fecha actual en zona horaria de Argentina (se almacena en UTC)
      const ahora = new Date();

      // ⭐ Modelo híbrido: intentar consumir crédito prepago (FIFO, con lock) sin importar
      // el tipo_descarga declarado del usuario; si no hay compra con saldo, cae a cuenta
      // corriente. La determinación de qué fuente se usó ocurre DENTRO de la transacción,
      // porque depende de si efectivamente se consiguió consumir una compra.
      let usoPrepagoFinal = false;
      // Si esta descarga consumió saldo prepago de un Mayorista real (no SERSA),
      // acá queda su id_mayorista para chequear/avisar saldo bajo después del commit.
      let idMayoristaPoolConsumido: number | null = null;
      const savedDescarga = await this.descargaRepository.manager.transaction(
        async (manager) => {
          const descargaRepo = manager.getRepository(Descarga);
          const compraRepo = manager.getRepository(CompraPrepago);

          const esDistribuidorDeMayorista =
            user.rol === 3 && !!user.id_mayorista && user.id_mayorista !== 1;

          let idCompraConsumida: number | null = null;
          let idCompraMayoristaConsumida: number | null = null;
          let usoPrepago: boolean;
          let estadoMayoristaInicial: EstadoDescarga;
          let estadoDistribuidorInicial: EstadoDescarga;

          if (esDistribuidorDeMayorista) {
            // ⭐ Distribuidor de un Mayorista no-SERSA: dos chequeos INDEPENDIENTES.
            // Lado Distribuidor (estadoDistribuidor): saldo prepago propio, comprado
            // por adelantado a su Mayorista.
            const compraDistribuidor = await compraRepo
              .createQueryBuilder('c')
              .setLock('pessimistic_write')
              .where('c.id_usuario = :userId', { userId: data.usuarioId })
              .andWhere('c.cantidad > c.cantidad_usada')
              .orderBy('c.fecha_compra', 'ASC')
              .addOrderBy('c.id', 'ASC')
              .getOne();
            if (compraDistribuidor) {
              compraDistribuidor.cantidad_usada += 1;
              await compraRepo.save(compraDistribuidor);
              idCompraConsumida = compraDistribuidor.id;
            }
            const distribuidorUsoPrepago = idCompraConsumida !== null;

            if (!distribuidorUsoPrepago) {
              // Sin saldo propio: revalidar cupo de cuenta corriente propio (defensa
              // ante condiciones de carrera) antes de tocar el pool del mayorista.
              const descargasPendientes = await manager
                .getRepository(Descarga)
                .count({
                  where: {
                    id_usuario: data.usuarioId,
                    estadoDistribuidor: EstadoDescarga.PENDIENTE_FACTURAR,
                  },
                });
              if (descargasPendientes >= user.limite_descargas) {
                throw new ForbiddenException(
                  'Has alcanzado el límite de descargas pendientes. No podés descargar hasta que se libere el límite.',
                );
              }
            }

            // Lado Mayorista (estadoMayorista): saldo prepago del propio Mayorista
            // con SERSA. Independiente del resultado del lado Distribuidor.
            let mayoristaUsoPrepago = false;
            const idUsuarioMayorista = await this.resolverIdUsuarioMayorista(
              user.id_mayorista,
              manager,
            );
            if (idUsuarioMayorista) {
              const compraMayorista = await compraRepo
                .createQueryBuilder('c')
                .setLock('pessimistic_write')
                .where('c.id_usuario = :idUsuarioMayorista', {
                  idUsuarioMayorista,
                })
                .andWhere('c.cantidad > c.cantidad_usada')
                .orderBy('c.fecha_compra', 'ASC')
                .addOrderBy('c.id', 'ASC')
                .getOne();
              if (compraMayorista) {
                compraMayorista.cantidad_usada += 1;
                await compraRepo.save(compraMayorista);
                mayoristaUsoPrepago = true;
                idCompraMayoristaConsumida = compraMayorista.id;
                // esDistribuidorDeMayorista ya garantiza id_mayorista !== 1 (no SERSA).
                idMayoristaPoolConsumido = user.id_mayorista;
              }
            }

            estadoDistribuidorInicial = distribuidorUsoPrepago
              ? EstadoDescarga.PREPAGO
              : EstadoDescarga.PENDIENTE_FACTURAR;
            estadoMayoristaInicial = mayoristaUsoPrepago
              ? EstadoDescarga.PREPAGO
              : EstadoDescarga.PENDIENTE_FACTURAR;
            usoPrepago = distribuidorUsoPrepago;

            this.logger.log(
              `[registrarDescarga] Distribuidor ${data.usuarioId} de mayorista ${user.id_mayorista}: ` +
                `estadoDistribuidor=${estadoDistribuidorInicial} (saldo propio=${distribuidorUsoPrepago}), ` +
                `estadoMayorista=${estadoMayoristaInicial} (pool mayorista=${mayoristaUsoPrepago})`,
            );
          } else {
            // Resto de roles (SERSA-directo, Mayorista con su propio saldo, Técnico,
            // Admin, Facturación): comportamiento existente, sin cambios.
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
              // El propio Mayorista (no SERSA) consumiendo su propia compra:
              // es su pool el que bajó, chequear saldo bajo después del commit.
              if (user.rol === 2 && user.id_mayorista !== 1) {
                idMayoristaPoolConsumido = user.id_mayorista;
              }
            }

            usoPrepago = idCompraConsumida !== null;

            if (usoPrepago) {
              // Dueño del crédito consumido: SERSA, o el propio Mayorista descargando
              // con su propio saldo (comprado directamente a SERSA) -> ya está pagado,
              // ambos estados quedan en PREPAGO e inmutables.
              estadoMayoristaInicial = EstadoDescarga.PREPAGO;
              estadoDistribuidorInicial = EstadoDescarga.PREPAGO;
              this.logger.log(
                `[registrarDescarga] Prepago propio (SERSA o Mayorista): Ambos estados = PREPAGO`,
              );
            } else {
              // Sin saldo prepago: cae a cuenta corriente. Defensa ante condiciones de
              // carrera: reconfirmar que sigue habiendo cupo de cuenta corriente.
              const estadoField =
                user.rol === 3 ? 'estadoDistribuidor' : 'estadoMayorista';
              const estadosQueBloquean = [
                EstadoDescarga.PENDIENTE_FACTURAR,
                EstadoDescarga.FACTURADO,
              ];
              const descargasPendientes = await manager
                .getRepository(Descarga)
                .count({
                  where: estadosQueBloquean.map((estado) => ({
                    id_usuario: data.usuarioId,
                    [estadoField]: estado,
                  })),
                });
              if (
                user.rol !== 1 &&
                user.rol !== 2 &&
                user.rol !== 5 &&
                descargasPendientes >= user.limite_descargas
              ) {
                throw new ForbiddenException(
                  'Has alcanzado el límite de descargas pendientes. No podés descargar hasta que se libere el límite.',
                );
              }

              estadoMayoristaInicial = EstadoDescarga.PENDIENTE_FACTURAR;
              estadoDistribuidorInicial = EstadoDescarga.PENDIENTE_FACTURAR;
              this.logger.log(
                `[registrarDescarga] Cuenta corriente: Ambos estados = PENDIENTE`,
              );
            }
          }

          usoPrepagoFinal = usoPrepago;

          const descarga = descargaRepo.create({
            id_usuario: data.usuarioId,
            id_certificado: data.controladorId,
            certificado_nombre: data.certificadoNombre,
            tipo_descarga: usoPrepago ? 'PREPAGO' : 'CUENTA_CORRIENTE', // ⭐ Fuente real de crédito de ESTA descarga
            estadoMayorista: estadoMayoristaInicial,
            estadoDistribuidor: estadoDistribuidorInicial,
            tamaño: data.tamaño,
            id_compra_prepago: idCompraConsumida,
            id_compra_prepago_mayorista: idCompraMayoristaConsumida,
            updated_at: ahora.toISOString(),
            created_at: ahora.toISOString(),
          });

          return await descargaRepo.save(descarga);
        },
      );

      // Fire-and-forget: si esta descarga consumió saldo de un Mayorista real,
      // chequear si quedó por debajo de su umbral y avisar por mail. No debe
      // bloquear ni arriesgar la respuesta de la descarga ya confirmada.
      if (idMayoristaPoolConsumido !== null) {
        this.chequearYNotificarSaldoPrepagoBajo(idMayoristaPoolConsumido).catch(
          (err) =>
            this.logger.error(
              `Error chequeando saldo prepago bajo: ${err.message}`,
            ),
        );
      }

      // Registrar en auditoría
      await this.auditoriaService.log(
        data.usuarioId,
        'DOWNLOAD' as any,
        'CERTIFICADO' as any,
        savedDescarga.id_descarga as any,
        null,
        {
          certificado: data.certificadoNombre,
          tipo_descarga: usoPrepagoFinal ? 'PREPAGO' : 'CUENTA_CORRIENTE',
        },
        data.ipOrigen,
      );

      this.logger.log(
        `Descarga registrada con ID: ${savedDescarga.id_descarga}`,
      );

      // Convertir a formato IDescarga
      return this.convertToIDescarga(savedDescarga);
    } catch (error) {
      this.logger.error('Error registrando descarga:', error.message);
      throw error;
    }
  }
  /**
   * Convertir entidad Descarga a IDescarga. `mayoristaMap` es opcional: solo lo
   * pasa `getDescargas` (listados) para agregar `usuario.nombreMayorista` sin
   * hacer una query por fila; las conversiones de una sola descarga (registrar/
   * actualizar estado) quedan sin ese dato.
   */
  private convertToIDescarga(
    descarga: Descarga,
    mayoristaMap?: Map<number, string>,
  ): IDescarga {
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
      numeroFacturaCompraPrepago:
        descarga.compraPrepago?.numero_factura ?? null,
      numeroFacturaCompraPrepagoMayorista:
        descarga.compraPrepagoMayorista?.numero_factura ?? null,
      usuario: descarga.usuario
        ? {
            nombre: descarga.usuario.nombre,
            cuit: descarga.usuario.cuit,
            mail: descarga.usuario.mail,
            idrol: descarga.usuario.rol,
            id_mayorista: descarga.usuario.id_mayorista,
            nombreMayorista: mayoristaMap
              ? this.resolverNombreMayoristaDeMapa(
                  descarga.usuario.id_mayorista,
                  mayoristaMap,
                )
              : undefined,
          }
        : undefined,
    };
  }

  /**
   * Resuelve id_mayorista -> nombre a partir de un mapa ya construido, con el
   * caso especial id_mayorista=1 (SERSA, no tiene por qué existir como User rol=2).
   */
  private resolverNombreMayoristaDeMapa(
    idMayorista: number | null | undefined,
    mayoristaMap: Map<number, string>,
  ): string | null {
    if (!idMayorista) return null;
    if (idMayorista === 1) return 'SERSA';
    return mayoristaMap.get(idMayorista) ?? null;
  }

  /**
   * Resuelve en batch (una sola query IN) el nombre de cada Mayorista (User
   * rol=2) para una lista de id_mayorista. Mismo patrón que
   * UsersService.findAll — se duplica acá porque vive en un servicio distinto.
   */
  private async resolverNombresMayoristaBatch(
    idsMayorista: Array<number | null | undefined>,
    manager: EntityManager,
  ): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    const ids = [...new Set(idsMayorista)].filter(
      (id): id is number => !!id && id !== 1,
    );
    if (ids.length === 0) return map;
    const mayoristas = await manager.getRepository(User).find({
      where: { id_usuario: In(ids), rol: 2 },
      select: ['id_usuario', 'nombre'],
    });
    mayoristas.forEach((m) => map.set(m.id_usuario, m.nombre));
    return map;
  }

  /**
   * Calcular (sin persistir) el saldo prepago disponible de un usuario,
   * como suma de saldos (cantidad - cantidad_usada) de sus compras_prepago.
   * A diferencia del diseño anterior, esto NO se cachea en users.limite_descargas
   * (esa columna ahora es exclusivamente el límite de cuenta corriente).
   */
  private async obtenerSaldoPrepago(
    userId: number,
    manager: EntityManager,
  ): Promise<number> {
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
  async registrarErrorDescarga(
    data: RegistrarErrorDescargaData,
  ): Promise<void> {
    try {
      this.logger.log(
        `Registrando error de descarga para usuario ${data.usuarioId}`,
      );

      await this.auditoriaService.log(
        data.usuarioId,
        'ERROR' as any,
        'CERTIFICADO' as any,
        null,
        null,
        {
          error: data.error,
        },
        data.ipOrigen,
      );
    } catch (error) {
      this.logger.error('Error registrando error de descarga:', error.message);
    }
  }
  /**
   * Obtener certificado PEM por ID de descarga
   */
  async getCertificadoPem(
    descargaId: string | number,
    userId: number,
    userRole: number,
  ): Promise<{
    content: string;
    filename: string;
    contentType: string;
  }> {
    //Verificar que la descarga exista
    const descarga = await this.descargaRepository.findOne({
      where: { id_descarga: String(descargaId) },
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
      where: { id_certificado: String(descarga.id_certificado) },
    });

    if (!certificado) {
      throw new Error('Certificado no encontrado');
    }

    return {
      //TODO- Corregir, el content tiene que ser el metadata del certificado
      content: certificado.metadata,
      filename: descarga.certificado_nombre,
      contentType: 'application/x-pem-file',
    };
  }
  /**
   * Cambiar estado de descarga
   */ async updateEstadoDescarga(
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
    ip?: string,
  ): Promise<IDescarga> {
    const descarga = await this.descargaRepository.findOne({
      where: { id_descarga: String(descargaId) },
    });
    if (!descarga) {
      throw new Error('Descarga no encontrada');
    }
    const duenioDescarga = await this.descargaRepository.manager
      .getRepository(User)
      .findOne({
        where: { id_usuario: descarga.id_usuario },
        select: ['id_mayorista', 'rol'],
      });
    const idMayorista = duenioDescarga?.id_mayorista || 0;
    // Cada estado es inmutable de forma independiente: queda "definitivo" cuando su
    // propio lado (Mayorista↔SERSA o Distribuidor↔Mayorista) fue efectivamente cubierto
    // con saldo prepago real al momento de la descarga.
    const estadoMayoristaInmutable =
      descarga.estadoMayorista === EstadoDescarga.PREPAGO;
    const estadoDistribuidorInmutable =
      descarga.estadoDistribuidor === EstadoDescarga.PREPAGO;
    // Distribuidor de un Mayorista no-SERSA: el pool prepago consumido del lado
    // Mayorista es independiente del lote referenciado por id_compra_prepago (que
    // representa el saldo propio del Distribuidor, si lo hay) — se restaura aparte.
    const esDistribuidorDeMayorista =
      duenioDescarga?.rol === 3 && idMayorista !== 1 && idMayorista !== 0;

    // ⭐ NUEVA LÓGICA: Validar permisos según rol
    // Distribuidor (3) y Técnico (5) nunca pueden cambiar estados
    if (userRole === 3 || userRole === 5) {
      const rolName = userRole === 3 ? 'Distribuidores' : 'Técnicos';
      throw new ForbiddenException(
        `${rolName} no pueden cambiar estados de descargas`,
      );
    }

    // Mayorista (2): solo puede modificar descargas de sus propios distribuidores (mismo id_mayorista)
    if (userRole === 2) {
      const idMayoristaLogueado =
        await this.obtenerIdMayoristaPorUsuario(userId);
      if (idMayoristaLogueado !== idMayorista) {
        throw new ForbiddenException(
          'No podés modificar descargas de distribuidores que no son tuyos',
        );
      }
    }

    // Estados que liberan deuda (garantia/bonificado): permiten modificar incluso PREPAGO SERSA
    const esEstadoLibreDeuda =
      nuevoEstado.estadoMayorista === EstadoDescarga.GARANTIA ||
      nuevoEstado.estadoMayorista === EstadoDescarga.BONIFICADO ||
      nuevoEstado.estadoDistribuidor === EstadoDescarga.GARANTIA ||
      nuevoEstado.estadoDistribuidor === EstadoDescarga.BONIFICADO;

    // ⭐ Bloqueo selectivo de PREPAGO, independiente por lado
    if (
      estadoMayoristaInmutable &&
      !esEstadoLibreDeuda &&
      nuevoEstado.estadoMayorista !== undefined &&
      nuevoEstado.estadoMayorista !== EstadoDescarga.PREPAGO
    ) {
      throw new ForbiddenException(
        'No se puede cambiar estadoMayorista. El estado PREPAGO en el mayorista es definitivo e inmutable.',
      );
    }

    if (
      estadoDistribuidorInmutable &&
      !esEstadoLibreDeuda &&
      nuevoEstado.estadoDistribuidor !== undefined &&
      nuevoEstado.estadoDistribuidor !== EstadoDescarga.PREPAGO
    ) {
      throw new ForbiddenException(
        'No se puede cambiar estadoDistribuidor. El estado PREPAGO en el distribuidor es definitivo e inmutable.',
      );
    }

    const estadoAnterior = {
      estadoMayorista: descarga.estadoMayorista,
      estadoDistribuidor: descarga.estadoDistribuidor,
      numero_factura: descarga.numero_factura,
      referencia_pago: descarga.referencia_pago,
      numero_factura_distribuidor: descarga.numero_factura_distribuidor,
      referencia_pago_distribuidor: descarga.referencia_pago_distribuidor,
    };

    // El estado ya estaba libre de deuda antes de este cambio (evita re-acreditar
    // crédito si se re-guarda el mismo estado Garantia/Bonificado dos veces)
    const yaEstabaLibreDeuda =
      estadoAnterior.estadoMayorista === EstadoDescarga.GARANTIA ||
      estadoAnterior.estadoMayorista === EstadoDescarga.BONIFICADO ||
      estadoAnterior.estadoDistribuidor === EstadoDescarga.GARANTIA ||
      estadoAnterior.estadoDistribuidor === EstadoDescarga.BONIFICADO;

    this.logger.log(
      `[updateEstadoDescarga] Usuario ${userId} (rol ${userRole}) intenta cambiar estados`,
    );
    this.logger.log(
      `[updateEstadoDescarga] Descarga ${descargaId}: tipo=${descarga.tipo_descarga}, mayorista=${idMayorista}`,
    );
    this.logger.log(`[updateEstadoDescarga] Estado anterior:`, estadoAnterior);
    this.logger.log(
      `[updateEstadoDescarga] Nuevo estadoMayorista solicitado:`,
      nuevoEstado.estadoMayorista,
    );
    this.logger.log(
      `[updateEstadoDescarga] Nuevo estadoDistribuidor solicitado:`,
      nuevoEstado.estadoDistribuidor,
    );

    // ⭐ NUEVA LÓGICA: Determinar qué estados puede cambiar el usuario
    // Admin (1) y Facturación (4): Pueden cambiar estadoMayorista
    if (userRole === 1 || userRole === 4) {
      if (nuevoEstado.estadoMayorista !== undefined) {
        descarga.estadoMayorista = nuevoEstado.estadoMayorista;
        this.logger.log(
          `[updateEstadoDescarga] Admin/Facturación cambió estadoMayorista`,
        );
      }
      //Si es distribuidor de SERSA (id_mayorista = 1), puede cambiar tambien estadoDistribuidor con el mismo valor del estado mayorista
      if (idMayorista === 1) {
        descarga.estadoDistribuidor = nuevoEstado.estadoMayorista;
        this.logger.log(
          `[updateEstadoDescarga] Admin/Facturación cambió estadoDistribuidor (SERSA)`,
        );

        // Espejar también el número de factura/referencia de pago hacia los campos del distribuidor
        if (nuevoEstado.estadoMayorista === EstadoDescarga.FACTURADO) {
          descarga.numero_factura_distribuidor =
            nuevoEstado.numero_factura || descarga.numero_factura_distribuidor;
        } else if (
          nuevoEstado.estadoMayorista === EstadoDescarga.PENDIENTE_FACTURAR
        ) {
          descarga.numero_factura_distribuidor = null;
          descarga.referencia_pago_distribuidor = null;
        }

        if (nuevoEstado.estadoMayorista === EstadoDescarga.COBRADO) {
          descarga.referencia_pago_distribuidor =
            nuevoEstado.referencia_pago ||
            descarga.referencia_pago_distribuidor;
        } else if (nuevoEstado.estadoMayorista === EstadoDescarga.FACTURADO) {
          descarga.referencia_pago_distribuidor = null;
        }
      }
    }
    // Mayorista (2): Puede cambiar estadoDistribuidor de sus distribuidores con los 5 estados
    else if (userRole === 2 && nuevoEstado.estadoDistribuidor !== undefined) {
      descarga.estadoDistribuidor = nuevoEstado.estadoDistribuidor;
      this.logger.log(
        `[updateEstadoDescarga] Mayorista cambió estadoDistribuidor a ${nuevoEstado.estadoDistribuidor}`,
      );
    }

    // Manejar número de factura del mayorista (solo para estado Facturado)
    if (nuevoEstado.estadoMayorista === EstadoDescarga.FACTURADO) {
      descarga.numero_factura =
        nuevoEstado.numero_factura || descarga.numero_factura;
    } else if (
      nuevoEstado.estadoMayorista === EstadoDescarga.PENDIENTE_FACTURAR
    ) {
      // Si retrocede a Pendiente, limpiar ambos
      descarga.numero_factura = null;
      descarga.referencia_pago = null;
    }

    // Manejar referencia de pago del mayorista (solo para estado Cobrado)
    if (nuevoEstado.estadoMayorista === EstadoDescarga.COBRADO) {
      descarga.referencia_pago =
        nuevoEstado.referencia_pago || descarga.referencia_pago;
    } else if (nuevoEstado.estadoMayorista === EstadoDescarga.FACTURADO) {
      // Si retrocede de Cobrado a Facturado, limpiar solo referencia_pago
      descarga.referencia_pago = null;
    }

    // Manejar número de factura del distribuidor (solo cuando lo cambia el Mayorista, estado Facturado)
    if (userRole === 2) {
      if (nuevoEstado.estadoDistribuidor === EstadoDescarga.FACTURADO) {
        descarga.numero_factura_distribuidor =
          nuevoEstado.numero_factura_distribuidor ||
          descarga.numero_factura_distribuidor;
      } else if (
        nuevoEstado.estadoDistribuidor === EstadoDescarga.PENDIENTE_FACTURAR
      ) {
        // Si retrocede a Pendiente, limpiar ambos
        descarga.numero_factura_distribuidor = null;
        descarga.referencia_pago_distribuidor = null;
      }

      // Manejar referencia de pago del distribuidor (solo para estado Cobrado)
      if (nuevoEstado.estadoDistribuidor === EstadoDescarga.COBRADO) {
        descarga.referencia_pago_distribuidor =
          nuevoEstado.referencia_pago_distribuidor ||
          descarga.referencia_pago_distribuidor;
      } else if (nuevoEstado.estadoDistribuidor === EstadoDescarga.FACTURADO) {
        // Si retrocede de Cobrado a Facturado, limpiar solo referencia_pago
        descarga.referencia_pago_distribuidor = null;
      }
    }

    // Actualizar fecha de facturación si se proporciona
    if (
      fechaFacturacion &&
      nuevoEstado.estadoMayorista === EstadoDescarga.FACTURADO
    ) {
      descarga.fecha_facturacion = fechaFacturacion;
    }

    // Guardar cambios
    const updatedDescarga = await this.descargaRepository.save(descarga);

    // Restaurar crédito prepago cuando se marca Garantia o Bonificado (solo si no
    // estaba ya en un estado libre de deuda, para no acreditar dos veces). Cada lado
    // se restaura de forma independiente, según haya quedado PREPAGO o no.
    const debeRestaurarLadoDistribuidor =
      esEstadoLibreDeuda && !yaEstabaLibreDeuda && estadoDistribuidorInmutable;
    const debeRestaurarLadoMayorista =
      esEstadoLibreDeuda && !yaEstabaLibreDeuda && estadoMayoristaInmutable;

    if (debeRestaurarLadoDistribuidor || debeRestaurarLadoMayorista) {
      await this.descargaRepository.manager.transaction(async (manager) => {
        const compraRepo = manager.getRepository(CompraPrepago);

        if (debeRestaurarLadoDistribuidor) {
          if (descarga.id_compra_prepago) {
            const compra = await compraRepo
              .createQueryBuilder('c')
              .setLock('pessimistic_write')
              .where('c.id = :id', { id: descarga.id_compra_prepago })
              .getOne();

            if (compra) {
              if (compra.cantidad_usada <= 0) {
                this.logger.warn(
                  `[updateEstadoDescarga] Compra ${compra.id} ya tenía cantidad_usada en 0 al restaurar crédito (lado distribuidor) de descarga ${descarga.id_descarga}`,
                );
              }
              compra.cantidad_usada = Math.max(0, compra.cantidad_usada - 1);
              await compraRepo.save(compra);
            } else {
              this.logger.warn(
                `[updateEstadoDescarga] Compra ${descarga.id_compra_prepago} no encontrada al restaurar crédito (lado distribuidor) de descarga ${descarga.id_descarga}`,
              );
            }
          } else {
            // Descarga histórica anterior a esta feature: no sabemos qué compra acreditar.
            this.logger.warn(
              `[updateEstadoDescarga] Descarga ${descarga.id_descarga} sin id_compra_prepago — no se pudo restaurar crédito (lado distribuidor) automáticamente`,
            );
          }
        }

        if (debeRestaurarLadoMayorista) {
          if (esDistribuidorDeMayorista) {
            // Pool del Mayorista, consumido de forma independiente del lote de
            // id_compra_prepago (que es el saldo propio del Distribuidor, si lo hay).
            // Preferir la referencia exacta (id_compra_prepago_mayorista); si la
            // descarga es anterior a que existiera esta columna, hacer fallback
            // genérico (compras_prepago es un contador agregado, no importa cuál
            // fila exacta se decrementa mientras el total cuadre).
            let compraMayorista: CompraPrepago | null = null;
            if (descarga.id_compra_prepago_mayorista) {
              compraMayorista = await compraRepo
                .createQueryBuilder('c')
                .setLock('pessimistic_write')
                .where('c.id = :id', {
                  id: descarga.id_compra_prepago_mayorista,
                })
                .getOne();
            } else {
              const idUsuarioMayorista = await this.resolverIdUsuarioMayorista(
                idMayorista,
                manager,
              );
              compraMayorista = idUsuarioMayorista
                ? await compraRepo
                    .createQueryBuilder('c')
                    .setLock('pessimistic_write')
                    .where('c.id_usuario = :idUsuarioMayorista', {
                      idUsuarioMayorista,
                    })
                    .andWhere('c.cantidad_usada > 0')
                    .orderBy('c.id', 'DESC')
                    .getOne()
                : null;
            }

            if (compraMayorista) {
              compraMayorista.cantidad_usada = Math.max(
                0,
                compraMayorista.cantidad_usada - 1,
              );
              await compraRepo.save(compraMayorista);
            } else {
              this.logger.warn(
                `[updateEstadoDescarga] No se encontró lote del mayorista ${idMayorista} con cantidad_usada>0 al restaurar crédito (lado mayorista) de descarga ${descarga.id_descarga}`,
              );
            }
          }
          // SERSA-directo / Mayorista con su propio saldo: mismo lote que el lado
          // Distribuidor, ya restaurado arriba vía id_compra_prepago — no duplicar.
        }
      });
      this.logger.log(
        `[updateEstadoDescarga] Crédito PREPAGO restaurado (distribuidor=${debeRestaurarLadoDistribuidor}, mayorista=${debeRestaurarLadoMayorista}) para descarga ${descarga.id_descarga}`,
      );
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
        numero_factura_distribuidor:
          updatedDescarga.numero_factura_distribuidor,
        referencia_pago_distribuidor:
          updatedDescarga.referencia_pago_distribuidor,
      },
      ip,
    );

    return this.convertToIDescarga(updatedDescarga);
  }
  /**
   * Aplica al query builder los filtros de contexto compartidos entre
   * `getDescargas` (historial) y `getResumenFacturas` (agrupado por factura).
   * Asume que `query` ya tiene los joins `usuario`, `compraPrepago` y
   * `compraPrepagoMayorista`.
   */
  private aplicarFiltrosComunes(
    query: SelectQueryBuilder<Descarga>,
    params: any,
  ): void {
    const {
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
    } = params;

    if (usuarioId) {
      const usuarioIdNum =
        typeof usuarioId === 'string' ? parseInt(usuarioId, 10) : usuarioId;
      query.andWhere('descarga.id_usuario = :usuarioId', {
        usuarioId: usuarioIdNum,
      });
    }
    if (cuit) {
      query.andWhere('usuario.cuit LIKE :cuit', { cuit: `${cuit}%` });
    }
    if (nombre) {
      query.andWhere('usuario.nombre ILIKE :nombre', { nombre: `%${nombre}%` });
    }
    if (idMayorista) {
      const idMayoristaNum =
        typeof idMayorista === 'string'
          ? parseInt(idMayorista, 10)
          : idMayorista;
      query.andWhere('usuario.id_mayorista = :idMayorista', {
        idMayorista: idMayoristaNum,
      });
    }

    // Filtros de fecha usando zona horaria de Argentina
    if (fechaDesde) {
      query.andWhere(
        "(descarga.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date >= :fechaDesde",
        { fechaDesde },
      );
    }
    if (fechaHasta) {
      query.andWhere(
        "(descarga.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date <= :fechaHasta",
        { fechaHasta },
      );
    }
    if (mes) {
      const mesNum = typeof mes === 'string' ? parseInt(mes, 10) : mes;
      query.andWhere(
        "EXTRACT(MONTH FROM descarga.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires') = :mes",
        { mes: mesNum },
      );
    }
    if (anio) {
      const anioNum = typeof anio === 'string' ? parseInt(anio, 10) : anio;
      query.andWhere(
        "EXTRACT(YEAR FROM descarga.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires') = :anio",
        { anio: anioNum },
      );
    }
    if (controladorId) {
      query.andWhere('descarga.id_certificado ILIKE :controladorId', {
        controladorId: `%${controladorId}%`,
      });
    }
    // ⭐ FILTRADO DE ESTADOS - Lógica flexible
    // Ambos estados pueden filtrarse independientemente según el parámetro explícito
    if (estadoMayorista) {
      query.andWhere('descarga.estadoMayorista = :estadoMayorista', {
        estadoMayorista,
      });
    }
    if (estadoDistribuidor) {
      query.andWhere('descarga.estadoDistribuidor = :estadoDistribuidor', {
        estadoDistribuidor,
      });
    }
    if (marca) {
      query.andWhere('descarga.marca = :marca', { marca });
    }
  }

  /**
   * Un actor cuenta como "Mayorista o SERSA" a los fines de qué compra prepago
   * cubre el lado Mayorista de una descarga PREPAGO: el propio Mayorista (rol=2)
   * o cualquier usuario de SERSA (id_mayorista=1) consumen su propia compraPrepago;
   * un Distribuidor de un Mayorista no-SERSA depende de compraPrepagoMayorista.
   * Mismo criterio que ya usa el frontend (certificados/page.tsx) para decidir
   * qué "Factura Prepago" mostrar — replicado acá para el Resumen por Factura.
   */
  private esMayoristaOSersa(descarga: Descarga): boolean {
    return descarga.usuario?.id_mayorista === 1 || descarga.usuario?.rol === 2;
  }

  /**
   * Resuelve la factura efectiva del lado Mayorista de una descarga, usada
   * para agrupar el Resumen por Factura en modo MAYORISTA.
   * - estadoMayorista === 'PREPAGO': compraPrepago propia si el actor es el
   *   Mayorista o SERSA; compraPrepagoMayorista si es un Distribuidor de otro
   *   Mayorista. Sin compra asociada -> bucket SALDO_MIGRADO. Con compra,
   *   además de la factura se devuelve cantidadComprada/cantidadUtilizada
   *   (`compra.cantidad`/`compra.cantidad_usada`) para mostrar el saldo.
   * - estadoMayorista !== 'PREPAGO': numero_factura de la propia descarga.
   *   Sin número aún -> bucket = el propio `estadoMayorista` (Pendiente de
   *   Facturar, Garantia, Bonificado, etc.), NO un literal genérico — así cada
   *   estado real queda en su propio grupo en vez de mezclarse.
   * OJO: se mira estadoMayorista, NO tipo_descarga — tipo_descarga es solo la
   * referencia histórica de cómo se cobró al actor con SU propio proveedor
   * (relevante para el lado Distribuidor), no si SERSA le cobró al Mayorista
   * vía prepago. Un Distribuidor puede estar en CUENTA_CORRIENTE con su
   * Mayorista mientras ese Mayorista está en PREPAGO con SERSA en la misma
   * descarga. Ver ARCHITECTURE.md, sección "Modelo de facturación de
   * `descargas`", para el caso real que expuso este bug.
   */
  private resolverFacturaEfectivaMayorista(descarga: Descarga): {
    numeroFactura: string | null;
    bucket: BucketFactura;
    cantidadComprada: number | null;
    cantidadUtilizada: number | null;
  } {
    if (descarga.estadoMayorista === 'PREPAGO') {
      const compra = this.esMayoristaOSersa(descarga)
        ? descarga.compraPrepago
        : descarga.compraPrepagoMayorista;
      return compra?.numero_factura
        ? {
            numeroFactura: compra.numero_factura,
            bucket: 'FACTURADO',
            cantidadComprada: compra.cantidad,
            cantidadUtilizada: compra.cantidad_usada,
          }
        : {
            numeroFactura: null,
            bucket: 'SALDO_MIGRADO',
            cantidadComprada: null,
            cantidadUtilizada: null,
          };
    }
    return descarga.numero_factura
      ? {
          numeroFactura: descarga.numero_factura,
          bucket: 'FACTURADO',
          cantidadComprada: null,
          cantidadUtilizada: null,
        }
      : {
          numeroFactura: null,
          bucket: descarga.estadoMayorista || 'Pendiente de Facturar',
          cantidadComprada: null,
          cantidadUtilizada: null,
        };
  }

  /**
   * Resuelve la factura efectiva del lado Distribuidor de una descarga, usada
   * para agrupar el Resumen por Factura en modo DISTRIBUIDOR. Solo tiene
   * sentido de negocio para descargas hechas por un Distribuidor (rol=3) — el
   * caller (getDescargas/getResumenFacturas) filtra eso explícitamente.
   * - PREPAGO: siempre la compraPrepago propia del Distribuidor.
   * - CUENTA_CORRIENTE (u otro): numero_factura_distribuidor de la descarga;
   *   sin número, bucket = el propio `estadoDistribuidor` (mismo criterio que
   *   el lado Mayorista, ver resolverFacturaEfectivaMayorista).
   */
  private resolverFacturaEfectivaDistribuidor(descarga: Descarga): {
    numeroFactura: string | null;
    bucket: BucketFactura;
    cantidadComprada: number | null;
    cantidadUtilizada: number | null;
  } {
    if (descarga.tipo_descarga === 'PREPAGO') {
      const compra = descarga.compraPrepago;
      return compra?.numero_factura
        ? {
            numeroFactura: compra.numero_factura,
            bucket: 'FACTURADO',
            cantidadComprada: compra.cantidad,
            cantidadUtilizada: compra.cantidad_usada,
          }
        : {
            numeroFactura: null,
            bucket: 'SALDO_MIGRADO',
            cantidadComprada: null,
            cantidadUtilizada: null,
          };
    }
    return descarga.numero_factura_distribuidor
      ? {
          numeroFactura: descarga.numero_factura_distribuidor,
          bucket: 'FACTURADO',
          cantidadComprada: null,
          cantidadUtilizada: null,
        }
      : {
          numeroFactura: null,
          bucket: descarga.estadoDistribuidor || 'Pendiente de Facturar',
          cantidadComprada: null,
          cantidadUtilizada: null,
        };
  }

  /**
   * Obtener historial de descargas con filtros
   */
  async getDescargas(
    params: any,
  ): Promise<{ descargas: IDescarga[]; total: number }> {
    const {
      page = 1,
      limit = 50,
      numeroFactura,
      numeroFacturaExacto,
      bucket,
      modo = 'MAYORISTA',
    } = params;
    this.logger.log(`[getDescargas] Parámetros recibidos:`, params);

    const query = this.descargaRepository
      .createQueryBuilder('descarga')
      .leftJoinAndSelect('descarga.usuario', 'usuario')
      .leftJoinAndSelect('descarga.compraPrepago', 'compraPrepago')
      .leftJoinAndSelect(
        'descarga.compraPrepagoMayorista',
        'compraPrepagoMayorista',
      )
      .where('1=1');

    this.aplicarFiltrosComunes(query, params);

    if (numeroFactura) {
      query.andWhere('descarga.numero_factura ILIKE :numeroFactura', {
        numeroFactura: `%${numeroFactura}%`,
      });
    }

    // El drill-down del Resumen por Factura (modo DISTRIBUIDOR) solo tiene
    // sentido de negocio para descargas hechas por un Distribuidor.
    if (modo === 'DISTRIBUIDOR') {
      query.andWhere('usuario.rol = 3');
    }

    if (numeroFacturaExacto) {
      const condicion =
        modo === 'DISTRIBUIDOR'
          ? `(
              (descarga.tipo_descarga = 'PREPAGO' AND compraPrepago.numero_factura = :numeroFacturaExacto)
              OR (descarga.tipo_descarga IS DISTINCT FROM 'PREPAGO' AND descarga.numero_factura_distribuidor = :numeroFacturaExacto)
            )`
          : `(
              (descarga.estadoMayorista = 'PREPAGO' AND (
                ((usuario.id_mayorista = 1 OR usuario.rol = 2) AND compraPrepago.numero_factura = :numeroFacturaExacto)
                OR (NOT (usuario.id_mayorista = 1 OR usuario.rol = 2) AND compraPrepagoMayorista.numero_factura = :numeroFacturaExacto)
              ))
              OR (descarga.estadoMayorista IS DISTINCT FROM 'PREPAGO' AND descarga.numero_factura = :numeroFacturaExacto)
            )`;
      query.andWhere(condicion, { numeroFacturaExacto });
    }
    if (bucket === 'SALDO_MIGRADO') {
      const condicion =
        modo === 'DISTRIBUIDOR'
          ? `descarga.tipo_descarga = 'PREPAGO' AND compraPrepago.numero_factura IS NULL`
          : `descarga.estadoMayorista = 'PREPAGO' AND (
              ((usuario.id_mayorista = 1 OR usuario.rol = 2) AND compraPrepago.numero_factura IS NULL)
              OR (NOT (usuario.id_mayorista = 1 OR usuario.rol = 2) AND compraPrepagoMayorista.numero_factura IS NULL)
            )`;
      query.andWhere(condicion);
    } else if (bucket) {
      // Cualquier otro valor de bucket es el texto literal de
      // estadoMayorista/estadoDistribuidor sin número de factura (Pendiente
      // de Facturar, Garantia, Bonificado, etc.) — ver
      // resolverFacturaEfectivaMayorista/Distribuidor.
      const condicion =
        modo === 'DISTRIBUIDOR'
          ? `descarga.estadoDistribuidor = :bucket AND descarga.numero_factura_distribuidor IS NULL`
          : `descarga.estadoMayorista = :bucket AND descarga.numero_factura IS NULL`;
      query.andWhere(condicion, { bucket });
    }

    this.logger.log(
      `[getDescargas] Query construida, ejecutando... page: ${page}, limit: ${limit}`,
    );

    const [descargas, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('descarga.created_at', 'DESC')
      .getManyAndCount();

    this.logger.log(
      `[getDescargas] Resultado: ${total} descargas encontradas, retornando ${descargas.length}`,
    );

    const mayoristaMap = await this.resolverNombresMayoristaBatch(
      descargas.map((d) => d.usuario?.id_mayorista),
      this.descargaRepository.manager,
    );

    return {
      descargas: descargas.map((d) => this.convertToIDescarga(d, mayoristaMap)),
      total,
    };
  }

  /**
   * Resumen de descargas agrupado por factura efectiva, en dos modos
   * independientes (ver resolverFacturaEfectivaMayorista/Distribuidor):
   * - MAYORISTA (default): agrupa TODAS las descargas por (Mayorista, factura).
   * - DISTRIBUIDOR: agrupa solo las descargas hechas por un Distribuidor
   *   (rol=3), por (Distribuidor, factura de ese lado).
   * Trae todas las descargas que matchean los filtros de contexto y agrupa en
   * memoria: no hay columna persistida para la factura efectiva, así que no
   * se puede agrupar con GROUP BY en SQL. Si el volumen crudo crece mucho,
   * considerar migrar a un GROUP BY con COALESCE en SQL. No pagina: el
   * frontend arma la vista seccionada por Mayorista con el listado completo.
   */
  async getResumenFacturas(
    params: any,
  ): Promise<{ facturas: ResumenFacturaDto[]; total: number }> {
    const { modo = 'MAYORISTA' } = params;

    const query = this.descargaRepository
      .createQueryBuilder('descarga')
      .leftJoinAndSelect('descarga.usuario', 'usuario')
      .leftJoinAndSelect('descarga.compraPrepago', 'compraPrepago')
      .leftJoinAndSelect(
        'descarga.compraPrepagoMayorista',
        'compraPrepagoMayorista',
      )
      .where('1=1');

    this.aplicarFiltrosComunes(query, params);

    if (modo === 'DISTRIBUIDOR') {
      query.andWhere('usuario.rol = 3');
    }

    const descargas = await query.getMany();

    const UMBRAL_ADVERTENCIA = 20000;
    if (descargas.length > UMBRAL_ADVERTENCIA) {
      this.logger.warn(
        `[getResumenFacturas] Volumen crudo alto (${descargas.length} descargas) antes de agrupar. Considerar GROUP BY SQL si esto se vuelve frecuente.`,
      );
    }

    const mayoristaMap = await this.resolverNombresMayoristaBatch(
      descargas.map((d) => d.usuario?.id_mayorista),
      this.descargaRepository.manager,
    );

    type Grupo = {
      numeroFactura: string | null;
      bucket: BucketFactura;
      idMayorista: number | null;
      idUsuario: number | null;
      nombreUsuario: string | null;
      cantidadDescargas: number;
      cantidadComprada: number | null;
      cantidadUtilizada: number | null;
      primeraDescarga: Date;
      ultimaDescarga: Date;
    };
    const grupos = new Map<string, Grupo>();

    for (const descarga of descargas) {
      const idMayorista = descarga.usuario?.id_mayorista ?? null;
      const { numeroFactura, bucket, cantidadComprada, cantidadUtilizada } =
        modo === 'DISTRIBUIDOR'
          ? this.resolverFacturaEfectivaDistribuidor(descarga)
          : this.resolverFacturaEfectivaMayorista(descarga);

      const idUsuario = modo === 'DISTRIBUIDOR' ? descarga.id_usuario : null;
      const nombreUsuario =
        modo === 'DISTRIBUIDOR' ? (descarga.usuario?.nombre ?? null) : null;

      const key =
        modo === 'DISTRIBUIDOR'
          ? `${idUsuario}::${bucket}::${numeroFactura ?? ''}`
          : `${idMayorista}::${bucket}::${numeroFactura ?? ''}`;

      const existente = grupos.get(key);
      if (!existente) {
        grupos.set(key, {
          numeroFactura,
          bucket,
          idMayorista,
          idUsuario,
          nombreUsuario,
          cantidadDescargas: 1,
          // Todas las descargas de un mismo grupo FACTURADO-PREPAGO comparten
          // la misma CompraPrepago, así que no hace falta recalcular en cada
          // iteración (a diferencia de cantidadDescargas/fechas).
          cantidadComprada,
          cantidadUtilizada,
          primeraDescarga: descarga.created_at,
          ultimaDescarga: descarga.created_at,
        });
      } else {
        existente.cantidadDescargas += 1;
        if (descarga.created_at < existente.primeraDescarga) {
          existente.primeraDescarga = descarga.created_at;
        }
        if (descarga.created_at > existente.ultimaDescarga) {
          existente.ultimaDescarga = descarga.created_at;
        }
      }
    }

    const todasLasFacturas: ResumenFacturaDto[] = Array.from(grupos.values())
      .map((g) => ({
        ...g,
        nombreMayorista: this.resolverNombreMayoristaDeMapa(
          g.idMayorista,
          mayoristaMap,
        ),
      }))
      .sort(
        (a, b) =>
          new Date(b.ultimaDescarga).getTime() -
          new Date(a.ultimaDescarga).getTime(),
      );

    return { facturas: todasLasFacturas, total: todasLasFacturas.length };
  }
}
