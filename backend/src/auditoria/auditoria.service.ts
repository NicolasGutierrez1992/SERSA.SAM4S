import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Auditoria } from './entities/auditoria.entity';
import { Descarga } from '../descargas/entities/descarga.entity';
import { CreateAuditoriaDto } from './dto/create-auditoria.dto';
import { AppSettingsService } from '../common/services/app-settings.service';
import { MailService } from '../common/services/mail.service';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cuenta administradora "de sistema" — sus propias acciones no se muestran en
// auditoría (ni en el listado ni en las métricas): no aporta valor de
// seguimiento ver la actividad del propio dueño de la cuenta.
const CUIT_EXCLUIDO_DE_AUDITORIA = '00000000000';

export enum AuditoriaAccion {
  CREAR = 'CREAR',
  ACTUALIZAR = 'ACTUALIZAR',
  ELIMINAR = 'ELIMINAR',
  LOGIN = 'LOGIN',
  LOGIN_FALLIDO = 'LOGIN_FALLIDO',
  LOGOUT = 'LOGOUT',
  DESCARGAR = 'DESCARGAR',
}

export enum AuditoriaEntidad {
  USER = 'USER',
  CERTIFICADO = 'CERTIFICADO',
  DESCARGA = 'DESCARGA',
  NOTIFICACION = 'NOTIFICACION',
  APP_SETTING = 'APP_SETTING',
  COMPRA_PREPAGO = 'COMPRA_PREPAGO',
  CERTIFICADO_MAESTRO = 'CERTIFICADO_MAESTRO',
}
export enum Mayoristas {
  SERSA = 1,
  OLICART = 2,
  MARINUCCI = 3,
  COLOMA = 4,
  SANTICH = 5,
}
@Injectable()
export class AuditoriaService {
  constructor(
    @InjectRepository(Auditoria)
    private readonly auditoriaRepository: Repository<Auditoria>,
    @InjectRepository(Descarga)
    private readonly descargaRepository: Repository<Descarga>,
    private readonly appSettingsService: AppSettingsService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Para logs de CERTIFICADO/DESCARGA, objetivo_id guarda el UUID interno de la
   * fila `descargas`, no el número de controlador. Resuelve ese UUID contra
   * `descargas.id_certificado` para mostrar algo legible en la UI.
   */
  private async resolverReferenciasLegibles(
    logs: Auditoria[],
  ): Promise<
    Array<
      Auditoria & { objetivo_referencia: string | null; descripcion: string }
    >
  > {
    const idsDescarga = Array.from(
      new Set(
        logs
          .filter(
            (l) =>
              ['CERTIFICADO', 'DESCARGA'].includes(l.objetivo_tipo) &&
              l.objetivo_id &&
              UUID_REGEX.test(l.objetivo_id),
          )
          .map((l) => l.objetivo_id),
      ),
    );

    let referenciaPorId = new Map<string, string>();
    if (idsDescarga.length > 0) {
      const descargas = await this.descargaRepository.find({
        where: { id_descarga: In(idsDescarga) },
        select: ['id_descarga', 'id_certificado'],
      });
      referenciaPorId = new Map(
        descargas.map((d) => [d.id_descarga, d.id_certificado]),
      );
    }

    return logs.map((log) => ({
      ...log,
      objetivo_referencia:
        (log.objetivo_id && referenciaPorId.get(log.objetivo_id)) || null,
      descripcion: this.generarDescripcion(log),
    }));
  }

  /**
   * Descripción legible calculada al leer (no se persiste): a partir de accion +
   * objetivo_tipo + antes/despues ya guardados. No requiere tocar los ~15 puntos
   * del código que ya escriben logs, y cubre retroactivamente todo el historial
   * existente. Cualquier combinación no contemplada cae al fallback genérico.
   */
  private generarDescripcion(log: Auditoria): string {
    const { accion, objetivo_tipo, objetivo_id, antes, despues } = log;
    const a = antes || {};
    const d = despues || {};

    if (objetivo_tipo === 'USER') {
      if (accion === 'CREAR')
        return `Usuario creado: ${d.nombre} (CUIT ${d.cuit})`;
      if (accion === 'ELIMINAR') return `Usuario eliminado: ${a.nombre}`;
      if (accion === 'ACTUALIZAR') {
        if (d.accion === 'reset_password')
          return 'Restablecimiento de contraseña';
        return `Usuario actualizado: ${d.nombre || a.nombre}`;
      }
      if (accion === 'LOGIN') return 'Inicio de sesión';
      if (accion === 'LOGIN_FALLIDO') {
        return `Intento de login fallido (CUIT ${d.cuit}): ${d.motivo}`;
      }
      if (accion === 'LOGOUT') return 'Cierre de sesión';
    }

    if (objetivo_tipo === 'COMPRA_PREPAGO') {
      if (accion === 'CREAR') {
        return `Carga de ${d.cantidad} descargas prepago (factura ${d.numero_factura || 'sin factura'})`;
      }
      if (accion === 'ACTUALIZAR') {
        return `Factura de compra prepago actualizada a ${d.numero_factura}`;
      }
    }

    if (objetivo_tipo === 'CERTIFICADO_MAESTRO' && accion === 'CREAR') {
      return objetivo_id === 'ROOT_RTI'
        ? `Root_RTI cargado: ${d.archivo}`
        : `Certificado PFX cargado: ${d.archivo}`;
    }

    if (objetivo_tipo === 'APP_SETTING' && accion === 'ACTUALIZAR') {
      return `Configuración "${objetivo_id}" actualizada${d.value ? ' a ' + d.value : ''}`;
    }

    if (objetivo_tipo === 'CERTIFICADO') {
      if (accion === 'DOWNLOAD')
        return `Descarga de certificado ${d.certificado} (${d.tipo_descarga})`;
      if (accion === 'ERROR') return `Error al generar certificado: ${d.error}`;
    }

    if (objetivo_tipo === 'DESCARGA' && accion === 'UPDATE') {
      const cambios: string[] = [];
      if (a.estadoMayorista !== d.estadoMayorista) {
        cambios.push(
          `Estado Mayorista: ${a.estadoMayorista} → ${d.estadoMayorista}`,
        );
      }
      if (a.estadoDistribuidor !== d.estadoDistribuidor) {
        cambios.push(
          `Estado Distribuidor: ${a.estadoDistribuidor} → ${d.estadoDistribuidor}`,
        );
      }
      if (cambios.length > 0) return cambios.join(' | ');
    }

    return `${accion} sobre ${objetivo_tipo}`;
  }

  async create(createAuditoriaDto: CreateAuditoriaDto): Promise<Auditoria> {
    const auditoria = this.auditoriaRepository.create(createAuditoriaDto);
    return await this.auditoriaRepository.save(auditoria);
  }

  async log(
    userId: number | null,
    accion: AuditoriaAccion,
    entidadTipo: AuditoriaEntidad,
    entidadId?: string | number,
    valoresAnteriores?: any,
    valoresNuevos?: any,
    ip?: string,
    metadata?: any,
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
      limit = 20,
    } = queryDto;

    const queryBuilder = this.auditoriaRepository
      .createQueryBuilder('auditoria')
      .leftJoin('auditoria.actor', 'actor')
      .addSelect([
        'actor.id_usuario',
        'actor.nombre',
        'actor.cuit',
        'actor.rol',
      ])
      .andWhere('(actor.cuit IS NULL OR actor.cuit != :cuitExcluido)', {
        cuitExcluido: CUIT_EXCLUIDO_DE_AUDITORIA,
      });

    if (actor_id !== undefined) {
      queryBuilder.andWhere('auditoria.actor_id = :actor_id', { actor_id });
    }

    if (accion) {
      queryBuilder.andWhere('auditoria.accion = :accion', { accion });
    }

    if (objetivo_tipo) {
      queryBuilder.andWhere('auditoria.objetivo_tipo = :objetivo_tipo', {
        objetivo_tipo,
      });
    }
    if (objetivo_id !== undefined) {
      queryBuilder.andWhere('auditoria.objetivo_id = :objetivo_id', {
        objetivo_id,
      });
    }

    // Filtros de fecha usando zona horaria de Argentina (como en descargas)
    if (fecha_desde && fecha_hasta) {
      queryBuilder.andWhere(
        "(auditoria.timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN :fecha_desde AND :fecha_hasta",
        {
          fecha_desde,
          fecha_hasta,
        },
      );
    }

    const [logs, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('auditoria.timestamp', 'DESC')
      .getManyAndCount();

    const data = await this.resolverReferenciasLegibles(logs);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async exportToCSV(queryDto: any = {}): Promise<string> {
    const { data: logs } = await this.findAll({
      ...queryDto,
      page: 1,
      limit: 10000,
    });

    const headers = 'ID,Usuario,Acción,Entidad,Entidad ID,IP,Fecha\n';
    const rows = logs
      .map((log) => {
        const usuario = log.actor?.nombre || 'N/A';
        const entidadId = log.objetivo_referencia || log.objetivo_id || '';

        return `${log.id_auditoria},"${usuario}","${log.accion}","${log.objetivo_tipo}","${entidadId}","${log.ip}","${log.timestamp.toISOString()}"`;
      })
      .join('\n');

    return headers + rows;
  }

  private queryConFiltroFecha(fechaDesde?: string, fechaHasta?: string) {
    const qb = this.auditoriaRepository
      .createQueryBuilder('auditoria')
      .andWhere(
        '(auditoria.actor_id IS NULL OR auditoria.actor_id NOT IN (SELECT id_usuario FROM users WHERE cuit = :cuitExcluido))',
        { cuitExcluido: CUIT_EXCLUIDO_DE_AUDITORIA },
      );
    if (fechaDesde && fechaHasta) {
      qb.andWhere(
        "(auditoria.timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN :fechaDesde AND :fechaHasta",
        {
          fechaDesde,
          fechaHasta,
        },
      );
    }
    return qb;
  }

  async getStatistics(fechaDesde?: string, fechaHasta?: string) {
    const totalAcciones = await this.queryConFiltroFecha(
      fechaDesde,
      fechaHasta,
    ).getCount();

    const accionesPorTipoRaw = await this.queryConFiltroFecha(
      fechaDesde,
      fechaHasta,
    )
      .select('auditoria.accion', 'accion')
      .addSelect('COUNT(*)', 'total')
      .groupBy('auditoria.accion')
      .orderBy('total', 'DESC')
      .getRawMany();

    const entidadesPorTipoRaw = await this.queryConFiltroFecha(
      fechaDesde,
      fechaHasta,
    )
      .select('auditoria.objetivo_tipo', 'objetivo_tipo')
      .addSelect('COUNT(*)', 'total')
      .groupBy('auditoria.objetivo_tipo')
      .orderBy('total', 'DESC')
      .getRawMany();

    const usuariosActivosRaw = await this.queryConFiltroFecha(
      fechaDesde,
      fechaHasta,
    )
      .leftJoin('auditoria.actor', 'actor')
      .andWhere('auditoria.actor_id IS NOT NULL')
      .select('auditoria.actor_id', 'actor_id')
      .addSelect('actor.nombre', 'nombre')
      .addSelect('COUNT(*)', 'total')
      .groupBy('auditoria.actor_id')
      .addGroupBy('actor.nombre')
      .orderBy('total', 'DESC')
      .limit(10)
      .getRawMany();

    const actividadPorDiaRaw = await this.queryConFiltroFecha(
      fechaDesde,
      fechaHasta,
    )
      .select(
        "(auditoria.timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')::date",
        'fecha',
      )
      .addSelect('COUNT(*)', 'total')
      .groupBy('fecha')
      .orderBy('fecha', 'ASC')
      .getRawMany();

    return {
      totalAcciones,
      accionesPorTipo: accionesPorTipoRaw.map((r) => ({
        accion: r.accion,
        total: Number(r.total),
      })),
      entidadesPorTipo: entidadesPorTipoRaw.map((r) => ({
        objetivo_tipo: r.objetivo_tipo,
        total: Number(r.total),
      })),
      usuariosActivos: usuariosActivosRaw.map((r) => ({
        actor_id: Number(r.actor_id),
        nombre: r.nombre ?? 'Usuario eliminado',
        total: Number(r.total),
      })),
      actividadPorDia: actividadPorDiaRaw.map((r) => ({
        fecha: r.fecha,
        total: Number(r.total),
      })),
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

  async notificarExcesoDescargas(
    mayoristaId: number,
    totalPendientes: number,
  ): Promise<void> {
    //obtener mayorista con id en enum Mayoristas
    const mayorista = Mayoristas[mayoristaId];
    if (!mayorista) {
      console.error(
        `Mayorista con ID ${mayoristaId} no encontrado en el enum.`,
      );
      return;
    }

    // Lógica para enviar notificación al administrador
    console.log(
      `Notificación: El mayorista ${mayorista} tiene ${totalPendientes} descargas pendientes de facturar.`,
    );

    try {
      const adminMailTo =
        await this.appSettingsService.obtenerSetting('ADMIN_MAIL_TO');
      if (!adminMailTo) {
        console.error('Falta ADMIN_MAIL_TO en app_settings');
        return;
      }

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; color: #222;">
          <h2 style="color: #b91c1c;">⚠️ Alerta de Descargas Pendientes</h2>
          <p>Estimado administrador,</p>
          <p>El <b>mayorista</b> <span style="color:#2563eb; font-weight:bold;">${mayorista}</span> ha superado el límite de descargas pendientes de facturar.</p>
          <p><b>Total de descargas pendientes:</b> <span style="color:#b91c1c; font-size:1.2em;">${totalPendientes}</span></p>
          <p style="margin-top:20px;">Por favor, revise la situación en el sistema de gestión de certificados.</p>
          <p style="margin-top:20px;"><a href="https://sersa-certs-frontend.vercel.app/">Ir al sistema</a></p>
          <hr style="margin:24px 0;"/>
          <p style="font-size:0.95em; color:#555;">Saludos,<br/>Sistema SERSA</p>
        </div>`;

      await this.mailService.sendMail(
        adminMailTo,
        '⚠️ Alerta: Exceso de descargas pendientes',
        htmlBody,
      );

      console.log(
        'Correo de notificación enviado al administrador via Gmail API.',
      );
    } catch (error) {
      console.error('Error enviando correo de notificación:', error);
    }
  }

  /**
   * Avisa a facturación/administración que el saldo prepago de un Mayorista
   * cayó por debajo de su umbral configurado (User.notification_limit_prepago).
   * Mismo destinatario y mecanismo que notificarExcesoDescargas.
   */
  async notificarSaldoPrepagoBajo(
    mayoristaId: number,
    nombreMayorista: string,
    saldoActual: number,
    umbral: number,
  ): Promise<void> {
    console.log(
      `Notificación: El mayorista ${nombreMayorista} (${mayoristaId}) tiene saldo prepago bajo: ${saldoActual} (umbral: ${umbral}).`,
    );

    try {
      const adminMailTo =
        await this.appSettingsService.obtenerSetting('ADMIN_MAIL_TO');
      if (!adminMailTo) {
        console.error('Falta ADMIN_MAIL_TO en app_settings');
        return;
      }

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; color: #222;">
          <h2 style="color: #b91c1c;">⚠️ Alerta de Saldo Prepago Bajo</h2>
          <p>Estimado administrador,</p>
          <p>El <b>mayorista</b> <span style="color:#2563eb; font-weight:bold;">${nombreMayorista}</span> tiene un saldo prepago por debajo del umbral configurado.</p>
          <p><b>Saldo actual:</b> <span style="color:#b91c1c; font-size:1.2em;">${saldoActual}</span></p>
          <p><b>Umbral configurado:</b> ${umbral}</p>
          <p style="margin-top:20px;">Se recomienda gestionar la recompra de créditos prepago con este mayorista.</p>
          <p style="margin-top:20px;"><a href="https://sersa-certs-frontend.vercel.app/">Ir al sistema</a></p>
          <hr style="margin:24px 0;"/>
          <p style="font-size:0.95em; color:#555;">Saludos,<br/>Sistema SERSA</p>
        </div>`;

      await this.mailService.sendMail(
        adminMailTo,
        `⚠️ Saldo prepago bajo: ${nombreMayorista}`,
        htmlBody,
      );

      console.log(
        'Correo de alerta de saldo prepago bajo enviado via Gmail API.',
      );
    } catch (error) {
      console.error('Error enviando correo de saldo prepago bajo:', error);
    }
  }
}
