import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EstadoDescarga, IDescarga } from '../shared/types';
import { User } from '../users/entities/user.entity';
import { Descarga } from './entities/descarga.entity';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { Certificado } from '../certificados/entities/certificado.entity';
import { TimezoneService } from '../common/timezone.service';
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
   * Registrar una nueva descarga exitosa
   */
  async registrarDescarga(data: RegistrarDescargaData): Promise<IDescarga> {
    try {
      this.logger.log(`Registrando descarga para usuario ${data.usuarioId}`);      const descarga = this.descargaRepository.create({
        id_usuario: data.usuarioId,
        id_certificado: data.controladorId,        
        certificado_nombre: data.certificadoNombre,
        estadoMayorista: EstadoDescarga.PENDIENTE_FACTURAR,
        estadoDistribuidor: EstadoDescarga.PENDIENTE_FACTURAR,
        tamaño: data.tamaño,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });

      const savedDescarga = await this.descargaRepository.save(descarga);

      // Registrar en auditoría
      await this.auditoriaService.log(
        data.usuarioId,
        'DOWNLOAD' as any,
        'CERTIFICADO' as any,
        savedDescarga.id_descarga as any,
        null,
        {
          certificado: data.certificadoNombre
        },
        data.ipOrigen
      );

      this.logger.log(`Descarga registrada con ID: ${savedDescarga.id_descarga}`);

      // Convertir a formato IDescarga
      return this.convertToIDescarga(savedDescarga);

    } catch (error) {
      this.logger.error('Error registrando descarga:', error.message);
      throw new Error(`Error al registrar descarga: ${error.message}`);
    }
  }

  /**
   * Convertir entidad Descarga a IDescarga
   */
  private convertToIDescarga(descarga: Descarga): IDescarga {
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
      usuario: descarga.usuario
        ? {
            nombre: descarga.usuario.nombre,
            cuit: descarga.usuario.cuit,
            mail: descarga.usuario.mail,
            idrol: descarga.usuario.id_rol
          }
        : undefined
    };
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
   */
  async updateEstadoDescarga(
    descargaId: number,
    nuevoEstado: { estadoMayorista?: EstadoDescarga; estadoDistribuidor?: EstadoDescarga },
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

    // Validar permisos
    if (userRole === 3) {
      throw new Error('No tiene permisos para cambiar estados');
    }

    const estadoAnterior = {
      estadoMayorista: descarga.estadoMayorista,
      estadoDistribuidor: descarga.estadoDistribuidor
    };
    console.log('Estado anterior:', estadoAnterior);
    console.log('Nuevo estado:', nuevoEstado);
    console.log('User role:', userRole);

    // Actualizar estados
    if (nuevoEstado.estadoMayorista) {
      descarga.estadoMayorista = nuevoEstado.estadoMayorista;
    }
    if (nuevoEstado.estadoDistribuidor && userRole === 1) {
      descarga.estadoDistribuidor = nuevoEstado.estadoDistribuidor;
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