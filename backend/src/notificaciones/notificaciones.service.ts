import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notificacion } from './entities/notificacion.entity';
import { 
  CreateNotificacionDto, 
  QueryNotificacionesDto, 
  UpdateNotificacionDto,
  TipoNotificacion,
  EstadoEnvio 
} from './dto/notificacion.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class NotificacionesService {
  constructor(
    @InjectRepository(Notificacion)
    private readonly notificacionRepository: Repository<Notificacion>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createNotificacionDto: CreateNotificacionDto): Promise<Notificacion> {
    const notificacion = this.notificacionRepository.create(createNotificacionDto);
    return await this.notificacionRepository.save(notificacion);
  }

  async createForUser(
    userId: number,
    tipo: TipoNotificacion,
    titulo: string,
    mensaje: string,
    data?: any
  ): Promise<Notificacion> {
    const user = await this.userRepository.findOne({ where: { id_usuario: userId } });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }
    
    return await this.create({
      destinatario_id: userId,
      tipo,
      payload: {
        titulo,
        mensaje,
        email: user.mail,
        ...data
      },
    });
  }

  async notificarLimiteAlcanzado(userId: number, limite: number): Promise<void> {
    await this.createForUser(
      userId,
      TipoNotificacion.LIMITE_ALCANZADO,
      'Límite de descargas alcanzado',
      `Has alcanzado el límite de ${limite} descargas pendientes. No podrás realizar más descargas hasta que sean facturadas.`,
      { limite }
    );
  }

  async notificarLimite80Porciento(userId: number, actual: number, limite: number): Promise<void> {
    await this.createForUser(
      userId,
      TipoNotificacion.LIMITE_80_PORCIENTO,
      'Alerta: Cerca del límite de descargas',
      `Has utilizado ${actual} de ${limite} descargas permitidas (${Math.round((actual/limite)*100)}%). Considera gestionar las descargas pendientes.`,
      { actual, limite, porcentaje: Math.round((actual/limite)*100) }
    );
  }

  async notificarDescargaCompletada(userId: number, certificadoId: string): Promise<void> {
    await this.createForUser(
      userId,
      TipoNotificacion.DESCARGA_COMPLETADA,
      'Descarga completada exitosamente',
      `La descarga del certificado ${certificadoId} se ha completado correctamente.`,
      { certificado_id: certificadoId }
    );
  }

  async notificarErrorDescarga(userId: number, certificadoId: string, error: string): Promise<void> {
    await this.createForUser(
      userId,
      TipoNotificacion.ERROR_DESCARGA,
      'Error en descarga',
      `Ha ocurrido un error al descargar el certificado ${certificadoId}: ${error}`,
      { certificado_id: certificadoId, error }
    );
  }

  async findAll(queryDto: QueryNotificacionesDto = {}) {
    const { 
      user_id, 
      tipo, 
      estado_envio, 
      page = 10, 
      limit = 100 
    } = queryDto;

    const queryBuilder = this.notificacionRepository
      .createQueryBuilder('notificacion')
      .leftJoinAndSelect('notificacion.destinatario', 'destinatario')
      .select([
        'notificacion.id_notificacion',
        'notificacion.destinatario_id',
        'notificacion.tipo',
        'notificacion.estado_envio',
        'notificacion.fecha',
        'notificacion.payload',
        'destinatario.id_usuario',
        'destinatario.nombre',
        'destinatario.cuit',
      ]);

    if (user_id !== undefined) {
      queryBuilder.andWhere('notificacion.destinatario_id = :user_id', { user_id });
    }

    if (tipo) {
      queryBuilder.andWhere('notificacion.tipo = :tipo', { tipo });
    }

    if (estado_envio !== undefined) {
      queryBuilder.andWhere('notificacion.estado_envio = :estado_envio', { estado_envio });
    }

    const [notificaciones, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('notificacion.fecha', 'DESC')
      .getManyAndCount();

    return {
      data: notificaciones,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Notificacion> {
    const notificacion = await this.notificacionRepository.findOne({
      where: { id_notificacion: id },
      relations: ['destinatario'],
    });

    if (!notificacion) {
      throw new NotFoundException(`Notificación con ID ${id} no encontrada`);
    }

    return notificacion;
  }

  async findByUser(userId: number, queryDto: QueryNotificacionesDto = {}) {
    return await this.findAll({ ...queryDto, user_id: userId });
  }

  async markAsSent(id: string): Promise<void> {
    await this.notificacionRepository.update({ id_notificacion: id }, {
      estado_envio: EstadoEnvio.ENVIADO,
    });
  }
  async markAsError(id: string, error: string): Promise<void> {
    const notificacion = await this.findOne(id);
    const updatedPayload = { 
      ...notificacion.payload, 
      error 
    };
    
    await this.notificacionRepository.update({ id_notificacion: id }, {
      estado_envio: EstadoEnvio.ERROR,
      payload: updatedPayload,
    });
  }

  async getPendingNotifications(): Promise<Notificacion[]> {
    return await this.notificacionRepository.find({
      where: { 
        estado_envio: EstadoEnvio.PENDIENTE 
      },
      relations: ['destinatario'],
      order: { fecha: 'ASC' },
      take: 50,
    });
  }

  async remove(id: string): Promise<void> {
    const notificacion = await this.findOne(id);
    await this.notificacionRepository.remove(notificacion);
  }

  async cleanup(diasRetencion: number = 90): Promise<number> {
    const fechaCorte = new Date();
    fechaCorte.setDate(fechaCorte.getDate() - diasRetencion);
    
    const result = await this.notificacionRepository
      .createQueryBuilder()
      .delete()
      .where('fecha < :fechaCorte AND estado_envio = :estado', { 
        fechaCorte,
        estado: EstadoEnvio.ENVIADO
      })
      .execute();
    
    return result.affected || 0;
  }
}