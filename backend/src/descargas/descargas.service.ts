import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { 
  EstadoDescarga, 
  IDescarga 
} from '../shared/types';
import { User } from '../users/entities/user.entity';
import { Descarga } from './entities/descarga.entity';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { Certificado } from '../certificados/entities/certificado.entity';
import { TimezoneService } from '../common/timezone.service';
import { 
  ForbiddenException, 
  NotFoundException, 
  BadRequestException 
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
   * notificar al administrador que el mayorista supero el limite de descargas pendientes
   */
  async notificarExcesoDescargasMayorista(mayoristaId: number, totalPendientes: number): Promise<void> {
    this.logger.warn(`El mayorista ${mayoristaId} ha superado el límite de descargas pendientes: ${totalPendientes}`);
    // Aquí se podría agregar lógica adicional, como enviar una notificación al usuario o administrador
    //La notificacion sera via mail
    await this.auditoriaService.notificarExcesoDescargas(mayoristaId, totalPendientes);
  }

  /**
   * Validar si un usuario puede descargar certificados
   * Admin (1) y Mayorista (2): siempre pueden
   * Distribuidor (3) y Facturación (4): deben tener límite disponible
   */
  async canUserDownload(userId: number): Promise<ValidacionDescargaDto> {
    const userRepository = this.descargaRepository.manager.getRepository(User);
    const user = await userRepository.findOne({ 
      where: { id_usuario: userId } 
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Admin (1) y Mayorista (2) siempre pueden descargar
    if (user.rol === 1 || user.rol === 2) {
      return {
        canDownload: true,
        message: '',
        userType: 'SIN_LIMITE',
        limiteDisponible: -1
      };
    }

    // Distribuidor (3) y Facturación (4) - validar límite
    if (user.limite_descargas <= 0) {
      const mensaje = user.tipo_descarga === 'PREPAGO'
        ? 'Debe realizar un prepago para descargar certificados'
        : 'Ha alcanzado el límite de descargas. Contacte a su proveedor';

      return {
        canDownload: false,
        message: mensaje,
        userType: user.tipo_descarga,
        limiteDisponible: user.limite_descargas
      };
    }

    return {
      canDownload: true,
      message: '',
      userType: user.tipo_descarga,
      limiteDisponible: user.limite_descargas
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
      }

      // Obtener usuario para determinar tipo_descarga
      const userRepository = this.descargaRepository.manager.getRepository(User);
      const user = await userRepository.findOne({ 
        where: { id_usuario: data.usuarioId } 
      });

      // ⭐ Determinar estado inicial según tipo_descarga
      const estadoInicial = user.tipo_descarga === 'PREPAGO'
        ? EstadoDescarga.PREPAGO
        : EstadoDescarga.PENDIENTE_FACTURAR;

      // Usar fecha actual en zona horaria de Argentina (se almacena en UTC)
      const ahora = new Date();
      const descarga = this.descargaRepository.create({
        id_usuario: data.usuarioId,
        id_certificado: data.controladorId,        
        certificado_nombre: data.certificadoNombre,
        tipo_descarga: user.tipo_descarga, // ⭐ Guardar tipo de descarga
        estadoMayorista: estadoInicial,
        estadoDistribuidor: estadoInicial,
        tamaño: data.tamaño,
        updated_at: ahora.toISOString(),
        created_at: ahora.toISOString()
      });

      const savedDescarga = await this.descargaRepository.save(descarga);

      // ⭐ Decrementar límite solo para PREPAGO
      if (user.tipo_descarga === 'PREPAGO') {
        await this.decrementarLimiteDescargas(data.usuarioId, 1);
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
          tipo_descarga: user.tipo_descarga
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
   * Decrementar límite de descargas para usuarios PREPAGO
   */
  async decrementarLimiteDescargas(usuarioId: number, cantidad: number): Promise<void> {
    const userRepository = this.descargaRepository.manager.getRepository(User);
    const user = await userRepository.findOne({
      where: { id_usuario: usuarioId }
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // No permitir negativos
    const nuevoLimite = Math.max(0, user.limite_descargas - cantidad);
    
    await userRepository.update(
      { id_usuario: usuarioId },
      { limite_descargas: nuevoLimite }
    );

    this.logger.log(
      `Límite de descarga actualizado: ${user.limite_descargas} → ${nuevoLimite} (Usuario: ${usuarioId})`
    );
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
    nuevoEstado: { estadoMayorista?: EstadoDescarga; estadoDistribuidor?: EstadoDescarga; numero_factura?: string; referencia_pago?: string },
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
    }

    // ⭐ NUEVA: Bloquear cambios si es PREPAGO
    if (descarga.tipo_descarga === 'PREPAGO' || descarga.estadoMayorista === EstadoDescarga.PREPAGO) {
      throw new ForbiddenException(
        'No se puede modificar el estado de descargas PREPAGO. El estado PREPAGO es definitivo e inmutable.'
      );
    }

    const idMayorista = await this.obtenerIdMayoristaPorUsuario(descarga.id_usuario);

    // Validar permisos
    if (userRole === 3) {
      throw new Error('No tiene permisos para cambiar estados');
    }

    const estadoAnterior = {
      estadoMayorista: descarga.estadoMayorista,
      estadoDistribuidor: descarga.estadoDistribuidor,
      numero_factura: descarga.numero_factura,
      referencia_pago: descarga.referencia_pago
    };
    console.log('Estado anterior:', estadoAnterior);
    console.log('Nuevo estado:', nuevoEstado);
    console.log('User role:', userRole);
    console.log('id mayorista: ', idMayorista);

    // Actualizar estados
    //Si el usuario logeado es administrador y el id mayorista del usuario que descargo es = 1 actualizo ambos estados
    if((userRole === 1 || userRole === 4) && idMayorista === 1){
      descarga.estadoMayorista = nuevoEstado.estadoMayorista;
      descarga.estadoDistribuidor = nuevoEstado.estadoDistribuidor;
    }else if (userRole === 1 ){
      descarga.estadoMayorista = nuevoEstado.estadoMayorista;
    }else{
      descarga.estadoDistribuidor = nuevoEstado.estadoDistribuidor;
    }

    // Manejar número de factura (solo para estado Facturado)
    if (nuevoEstado.estadoMayorista === EstadoDescarga.FACTURADO) {
      descarga.numero_factura = nuevoEstado.numero_factura || descarga.numero_factura;
    } else if (nuevoEstado.estadoMayorista === EstadoDescarga.PENDIENTE_FACTURAR) {
      // Si retrocede a Pendiente, limpiar ambos
      descarga.numero_factura = null;
      descarga.referencia_pago = null;
    }

    // Manejar referencia de pago (solo para estado Cobrado)
    if (nuevoEstado.estadoMayorista === EstadoDescarga.COBRADO) {
      descarga.referencia_pago = nuevoEstado.referencia_pago || descarga.referencia_pago;
    } else if (nuevoEstado.estadoMayorista === EstadoDescarga.FACTURADO) {
      // Si retrocede de Cobrado a Facturado, limpiar solo referencia_pago
      descarga.referencia_pago = null;
    }

    // Actualizar fecha de facturación si se proporciona
    if (fechaFacturacion && nuevoEstado.estadoMayorista === EstadoDescarga.FACTURADO) {
      descarga.fecha_facturacion = fechaFacturacion;
    }

    // Guardar cambios
    const updatedDescarga = await this.descargaRepository.save(descarga);

    // Registrar en auditoría
    await this.auditoriaService.log(
      userId,
      'UPDATE' as any,
      'DESCARGA' as any,
      descargaId as any,
      estadoAnterior,
      {
        estadoMayorista: updatedDescarga.estadoMayorista,
        estadoDistribuidor: updatedDescarga.estadoDistribuidor
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
      idMayorista,
      fechaDesde,
      fechaHasta,
      mes,
      anio,
      controladorId,
      estadoMayorista,
      marca
    } = params;

    this.logger.log(`[getDescargas] Parámetros recibidos:`, params);
    this.logger.log(`[getDescargas] usuarioId: ${usuarioId} (tipo: ${typeof usuarioId})`);
    this.logger.log(`[getDescargas] idMayorista: ${idMayorista} (tipo: ${typeof idMayorista})`);

    const query = this.descargaRepository.createQueryBuilder('descarga')
      .leftJoinAndSelect('descarga.usuario', 'usuario')
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
    }
    if (controladorId) {
      query.andWhere('descarga.id_certificado LIKE :controladorId', { controladorId: `${controladorId}%` });
    }
    if (estadoMayorista) {
      query.andWhere('descarga.estadoMayorista = :estadoMayorista', { estadoMayorista });
    }
    if (marca) {
      query.andWhere('descarga.marca = :marca', { marca });
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