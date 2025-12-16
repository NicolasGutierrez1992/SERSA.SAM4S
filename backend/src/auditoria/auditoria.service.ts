import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auditoria } from './entities/auditoria.entity';
import { CreateAuditoriaDto } from './dto/create-auditoria.dto';
import * as nodemailer from 'nodemailer';

export enum AuditoriaAccion {
  CREAR = 'CREAR',
  ACTUALIZAR = 'ACTUALIZAR',
  ELIMINAR = 'ELIMINAR',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  DESCARGAR = 'DESCARGAR',
}

export enum AuditoriaEntidad {
  USER = 'USER',
  CERTIFICADO = 'CERTIFICADO',
  DESCARGA = 'DESCARGA',
  NOTIFICACION = 'NOTIFICACION',
}
export enum Mayoristas{
  SERSA = 1,
  OLICART = 2,
  MARINUCCI =3,
  COLOMA = 4,
  SANTICH = 5
}
@Injectable()
export class AuditoriaService {
  constructor(
    @InjectRepository(Auditoria)
    private readonly auditoriaRepository: Repository<Auditoria>,
  ) {}

  async create(createAuditoriaDto: CreateAuditoriaDto): Promise<Auditoria> {
    const auditoria = this.auditoriaRepository.create(createAuditoriaDto);
    return await this.auditoriaRepository.save(auditoria);
  }

  async log(
    userId: number,
    accion: AuditoriaAccion,
    entidadTipo: AuditoriaEntidad,
    entidadId?: string | number,
    valoresAnteriores?: any,
    valoresNuevos?: any,
    ip?: string,
    metadata?: any
  ): Promise<void> {
    try {
      const auditoria = this.auditoriaRepository.create({
        actor_id: userId,
        accion,
        objetivo_tipo: entidadTipo,
        objetivo_id: entidadId ? String(entidadId) : null,
        antes: valoresAnteriores || null,
        despues: valoresNuevos || null,
        ip: ip || '0.0.0.0',
      });
      
      await this.auditoriaRepository.save(auditoria);
    } catch (error) {
      console.error('Error al registrar auditoría:', error);
    }
  }

  async findAll(queryDto: any = {}) {
    const {
      actor_id,
      accion,
      objetivo_tipo,
      objetivo_id,
      fecha_desde,
      fecha_hasta,
      page = 1,
      limit = 20
    } = queryDto;

    const queryBuilder = this.auditoriaRepository
      .createQueryBuilder('auditoria')
      .leftJoinAndSelect('auditoria.actor', 'actor');

    if (actor_id !== undefined) {
      queryBuilder.andWhere('auditoria.actor_id = :actor_id', { actor_id });
    }

    if (accion) {
      queryBuilder.andWhere('auditoria.accion = :accion', { accion });
    }

    if (objetivo_tipo) {
      queryBuilder.andWhere('auditoria.objetivo_tipo = :objetivo_tipo', { objetivo_tipo });
    }    if (objetivo_id !== undefined) {
      queryBuilder.andWhere('auditoria.objetivo_id = :objetivo_id', { objetivo_id });
    }

    // Filtros de fecha usando zona horaria de Argentina (como en descargas)
    if (fecha_desde && fecha_hasta) {
      queryBuilder.andWhere('(auditoria.timestamp AT TIME ZONE \'America/Argentina/Buenos_Aires\')::date BETWEEN :fecha_desde AND :fecha_hasta', {
        fecha_desde,
        fecha_hasta
      });
    }

    const [logs, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('auditoria.timestamp', 'DESC')
      .getManyAndCount();

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async exportToCSV(queryDto: any = {}): Promise<string> {
    const { data: logs } = await this.findAll({ ...queryDto, page: 1, limit: 10000 });

    const headers = 'ID,Usuario,Acción,Entidad,Entidad ID,IP,Fecha\n';
    const rows = logs.map(log => {
      const usuario = log.actor?.nombre || 'N/A';
      const entidadId = log.objetivo_id || '';
      
      return `${log.id_auditoria},"${usuario}","${log.accion}","${log.objetivo_tipo}","${entidadId}","${log.ip}","${log.timestamp.toISOString()}"`;
    }).join('\n');
    
    return headers + rows;
  }  async getStatistics(fechaDesde?: string, fechaHasta?: string) {
    const queryBuilder = this.auditoriaRepository.createQueryBuilder('auditoria');

    // Usar zona horaria de Argentina para filtros de fecha (como en descargas)
    if (fechaDesde && fechaHasta) {
      queryBuilder.andWhere('(auditoria.timestamp AT TIME ZONE \'America/Argentina/Buenos_Aires\')::date BETWEEN :fechaDesde AND :fechaHasta', {
        fechaDesde,
        fechaHasta
      });
    }

    const totalAcciones = await queryBuilder.getCount();

    // Estadísticas básicas por ahora
    return {
      totalAcciones,
      accionesPorTipo: [],
      entidadesPorTipo: [],
      usuariosActivos: [],
    };
  }

  async cleanup(diasRetencion: number = 365): Promise<number> {
    const fechaCorte = new Date();
    fechaCorte.setDate(fechaCorte.getDate() - diasRetencion);
    
    const result = await this.auditoriaRepository
      .createQueryBuilder()
      .delete()
      .where('timestamp < :fechaCorte', { fechaCorte })
      .execute();
    
    return result.affected || 0;
  }     

  async notificarExcesoDescargas(mayoristaId: number, totalPendientes: number): Promise<void> {
    //obtener mayorista con id en enum Mayoristas
    const mayorista = Mayoristas[mayoristaId];
    if (!mayorista) {
      console.error(`Mayorista con ID ${mayoristaId} no encontrado en el enum.`);
      return;
    }

    // Lógica para enviar notificación al administrador
    console.log(`Notificación: El mayorista ${mayorista} tiene ${totalPendientes} descargas pendientes de facturar.`);

    // Configuración de nodemailer usando variables de entorno
    const adminMailUser = process.env.ADMIN_MAIL_USER ;
    const adminMailPass = process.env.ADMIN_MAIL_PASS;
    const adminMailTo = process.env.ADMIN_MAIL_TO;

    if (!adminMailUser || !adminMailPass || !adminMailTo) {
      console.error('Faltan variables de entorno para el envío de correo de administración');
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: adminMailUser,
        pass: adminMailPass,
      },
    });

    const mailOptions = {
      from: `SERSA Notificaciones Certificados <${adminMailUser}>`,
      to: adminMailTo,
      subject: '⚠️ Alerta: Exceso de descargas pendientes',
      text: `ALERTA DE DESCARGAS PENDIENTES\n\nEstimado administrador,\n\nEl mayorista ${mayorista} ha superado el límite de descargas pendientes de facturar.\n\nTotal de descargas pendientes: ${totalPendientes}\n\nPor favor, revise la situación en el sistema de gestión de certificados.\n\nSaludos,\nSistema SERSA`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #222;">
          <h2 style="color: #b91c1c;">⚠️ Alerta de Descargas Pendientes</h2>
          <p>Estimado administrador,</p>
          <p>El <b>mayorista </b> <span style="color:#2563eb; font-weight:bold;">${mayorista}</span> ha superado el límite de descargas pendientes de facturar.</p>
          <p><b>Total de descargas pendientes:</b> <span style="color:#b91c1c; font-size:1.2em;">${totalPendientes}</span></p>
          <p style="margin-top:20px;">Por favor, revise la situación en el sistema de gestión de certificados.</p>
          <p style="margin-top:20px;">https://sersa-certs-frontend.vercel.app/.</p>
          <hr style="margin:24px 0;"/>
          <p style="font-size:0.95em; color:#555;">Saludos,<br/>Sistema SERSA</p>
        </div>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('Correo de notificación enviado al administrador.');
    } catch (error) {
      console.error('Error enviando correo de notificación:', error);
    }
  }
}