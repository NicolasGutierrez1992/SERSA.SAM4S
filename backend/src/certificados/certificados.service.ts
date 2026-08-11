import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { AfipService } from '../afip/afip.service';
import { DescargasService } from '../descargas/descargas.service';
import { TimezoneService } from '../common/timezone.service';
import { Certificado } from './entities/certificado.entity';
interface GenerarCertificadoDto {
  marca: string;
  modelo: string;
  numeroSerie: string;
}

interface CertificadoGeneradoResponse {
  downloadId: string;
  filename: string;
  size: number;
  checksum: string;
}

interface GeneracionJob {
  userId: number;
  status: 'PROCESANDO' | 'COMPLETADO' | 'ERROR';
  resultado?: CertificadoGeneradoResponse;
  mensajeError?: string;
  createdAt: number;
}

// Tiempo tras el cual se descarta un job del mapa en memoria (evita memory leak).
// No hace falta persistir esto en BD: el resultado real (la fila en `descargas`)
// ya queda guardado ahí; este mapa es solo para que el frontend pueda hacer polling
// del estado mientras la generación está en curso.
const JOB_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class CertificadosService {
  private readonly logger = new Logger(CertificadosService.name);

  // Jobs de generación en curso/recientes, en memoria. Nota: si el backend
  // llegara a correr con más de una instancia (Railway hoy corre una sola),
  // esto necesitaría moverse a un store compartido (Redis/BD) para que el
  // polling funcione sin importar a qué instancia responde el balanceador.
  private readonly jobs = new Map<string, GeneracionJob>();

  constructor(
    @InjectRepository(Certificado)
    private readonly certificadoRepository: Repository<Certificado>,
    private readonly afipService: AfipService,
    private readonly descargasService: DescargasService,
    private readonly timezoneService: TimezoneService,
  ) {
    this.logger.log(
      'CertificadosService initialized - Pure certificate generation',
    );
  }

  /**
   * Inicia la generación de forma asíncrona: valida rápido (sin llamar a AFIP)
   * y devuelve un jobId de inmediato. El trabajo real (AFIP + guardado) sigue
   * en background — así la respuesta HTTP nunca depende de que el llamado a
   * AFIP (que puede tardar 30-40s) termine dentro de la ventana de algún
   * proxy/edge intermedio (Next.js, Railway, etc.) que no controlamos.
   */
  async iniciarGeneracion(
    userId: number,
    datos: GenerarCertificadoDto,
    ip?: string,
  ): Promise<{ jobId: string; status: 'PROCESANDO' }> {
    // Validaciones rápidas (sin AFIP) — si algo acá falla, el error es inmediato,
    // no hace falta pasar por el flujo de job/polling.
    const validacion = await this.descargasService.canUserDownload(userId);
    if (!validacion.canDownload) {
      throw new BadRequestException(validacion.message);
    }

    const { marca, modelo, numeroSerie } = datos;
    if (marca !== 'SH') {
      throw new BadRequestException('La marca debe ser "SH"');
    }
    if (!['IA', 'RA'].includes(modelo)) {
      throw new BadRequestException('El modelo debe ser "IA" o "RA"');
    }
    if (!/^\d+$/.test(numeroSerie)) {
      throw new BadRequestException(
        'El número de serie debe contener solo dígitos numéricos',
      );
    }
    const numeroSerieNormalizado = numeroSerie.padStart(10, '0');
    if (numeroSerieNormalizado.length > 10) {
      throw new BadRequestException(
        'El número de serie no puede tener más de 10 dígitos',
      );
    }

    const jobId = randomUUID();
    this.jobs.set(jobId, {
      userId,
      status: 'PROCESANDO',
      createdAt: Date.now(),
    });

    // Fire-and-forget: no se espera acá, el resultado se consulta con getEstadoJob.
    this.procesarGeneracion(
      jobId,
      userId,
      { marca, modelo, numeroSerie: numeroSerieNormalizado },
      ip,
    ).catch((err) => {
      // procesarGeneracion ya captura sus propios errores y actualiza el job;
      // esto es solo una red de contención por si algo se escapa igual.
      this.logger.error(
        `Error no capturado procesando job ${jobId}: ${err?.message}`,
      );
      this.jobs.set(jobId, {
        userId,
        status: 'ERROR',
        mensajeError:
          'No se pudo generar el certificado. Intente nuevamente en unos minutos.',
        createdAt: Date.now(),
      });
    });

    return { jobId, status: 'PROCESANDO' };
  }

  /**
   * Estado de un job de generación. Verifica que el job pertenezca al usuario
   * que consulta (no filtrar el resultado de otro usuario).
   */
  getEstadoJob(
    jobId: string,
    userId: number,
  ): {
    status: 'PROCESANDO' | 'COMPLETADO' | 'ERROR';
    downloadId?: string;
    filename?: string;
    size?: number;
    checksum?: string;
    message?: string;
  } {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new NotFoundException(
        'Job de generación no encontrado (puede haber expirado)',
      );
    }
    if (job.userId !== userId) {
      throw new ForbiddenException(
        'No tenés permiso para consultar este job',
      );
    }

    if (job.status === 'COMPLETADO' && job.resultado) {
      return { status: 'COMPLETADO', ...job.resultado };
    }
    if (job.status === 'ERROR') {
      return { status: 'ERROR', message: job.mensajeError };
    }
    return { status: 'PROCESANDO' };
  }

  private scheduleJobCleanup(jobId: string) {
    setTimeout(() => this.jobs.delete(jobId), JOB_TTL_MS).unref();
  }

  /**
   * Generar certificado CRS usando AFIP (trabajo real, corre en background
   * disparado desde iniciarGeneracion). Delega el registro de descarga al
   * DescargasService y actualiza el job correspondiente al terminar.
   */
  private async procesarGeneracion(
    jobId: string,
    userId: number,
    datos: GenerarCertificadoDto,
    ip?: string,
  ): Promise<void> {
    const { marca, modelo, numeroSerie: numeroSerieNormalizado } = datos;
    // Se declara afuera del try para poder consultarla desde el catch: si ya
    // se llegó a crear, la generación en sí fue exitosa aunque algo posterior
    // (ej. notificaciones) haya fallado.
    let descarga: Awaited<
      ReturnType<typeof this.descargasService.registrarDescarga>
    > | undefined;
    try {
      this.logger.log(
        `Generando certificado para usuario ${userId}: ${marca} ${modelo} - ${numeroSerieNormalizado}`,
      );

      // Generar ID del certificado con formato: "SESHIA-0000001234"
      const idCertificado = `SE${marca}${modelo}-${numeroSerieNormalizado}`;

      // Verificar si el certificado ya existe
      let certificado = await this.certificadoRepository.findOne({
        where: { id_certificado: idCertificado },
      });

      // Generar certificado usando AFIP
      const certificadoAfip = await this.afipService.generarCertificado({
        marca,
        modelo,
        numeroSerie: numeroSerieNormalizado,
      });

      if (!certificado) {
        this.logger.log(
          `Certificado almacenado en DB: ${certificadoAfip.nombreArchivo}`,
        );
        this.logger.log(
          `Certificado almacenado en DB: ${certificadoAfip.certificadoPem}`,
        );
        this.logger.log(
          `Certificado almacenado en DB: ${certificadoAfip.tamaño}`,
        );
        // TODO - Analizar donde se almacenan los logs
        this.logger.log(
          `Certificado almacenado en DB: ${certificadoAfip.logs}`,
        );

        // Crear registro en certificados_v2
        certificado = this.certificadoRepository.create({
          id_certificado: idCertificado,
          fabricante: 'SE',
          marca,
          modelo,
          numero_serie: numeroSerieNormalizado,
          metadata: certificadoAfip.certificadoPem,
          archivo_referencia: certificadoAfip.nombreArchivo,
        });

        await this.certificadoRepository.save(certificado);
        this.logger.log(`Certificado almacenado en DB: ${idCertificado}`);
      } else {
        // Actualizar timestamp de updated_at y el metadata del certificado
        certificado.metadata = certificadoAfip.certificadoPem;
        // Usar fecha actual en zona horaria de Argentina (se almacena en UTC)
        certificado.updated_at = new Date();
        await this.certificadoRepository.save(certificado);
        this.logger.log(`Certificado existente actualizado: ${idCertificado}`);
      }

      // Registrar descarga usando DescargasService
      descarga = await this.descargasService.registrarDescarga({
        usuarioId: userId,
        controladorId: idCertificado,
        certificadoNombre: certificado.archivo_referencia,
        tamaño: certificadoAfip.tamaño,
        ipOrigen: ip,
      });
      this.logger.log(`Descarga registrada exitosamente: ${descarga.id}`);

      // ⭐ Validar si la suma de descargas pendientes supera el notification_limit del mayorista.
      // Best-effort: la generación (arriba) ya se completó y persistió — un fallo acá
      // (ej. la consulta de notification_limit, o el envío de mail) no debe convertir
      // una generación exitosa en un 500 para el cliente.
      try {
        const idMayorista =
          await this.descargasService.obtenerIdMayoristaPorUsuario(userId);
        if (idMayorista != 1) {
          const pendingDownloads =
            await this.descargasService.contarDescargasPendientesMayorista(
              idMayorista,
            );
          // ⭐ NUEVO: Obtener notification_limit desde la BD (usuario mayorista con rol=2)
          const notificationLimit =
            await this.descargasService.obtenerNotificationLimitMayorista(
              idMayorista,
            );

          this.logger.warn(
            `Cantidad de descargas pendientes del mayorista ${idMayorista}: ${pendingDownloads}`,
          );
          this.logger.warn(
            `Límite de notificación configurado: ${notificationLimit}`,
          );

          if (pendingDownloads >= notificationLimit) {
            this.logger.warn(
              `El mayorista ${idMayorista} ha superado el límite configurado en notificaciones (${notificationLimit})`,
            );
            // Fire-and-forget: el email no debe bloquear la respuesta HTTP
            this.descargasService
              .notificarExcesoDescargasMayorista(idMayorista, pendingDownloads)
              .catch((err) =>
                this.logger.error(
                  `Error enviando notificación de exceso de descargas: ${err.message}`,
                ),
              );
          }
        }
      } catch (notifError) {
        this.logger.error(
          `Error en validación de notification_limit (no afecta la generación ya completada): ${notifError.message}`,
        );
      }

      this.jobs.set(jobId, {
        userId,
        status: 'COMPLETADO',
        resultado: {
          downloadId: descarga.id.toString(),
          filename: certificado.archivo_referencia,
          size: certificado.metadata?.tamaño || 0,
          checksum: certificado.metadata?.checksum || '',
        },
        createdAt: Date.now(),
      });
      this.scheduleJobCleanup(jobId);
    } catch (error) {
      this.logger.error(
        `Error generando certificado para usuario ${userId}:`,
        error,
      );

      if (descarga) {
        // La descarga ya se había registrado con éxito antes de que ocurriera este
        // error (ej. falla en el bloque de notificaciones, o la respuesta HTTP se
        // cortó por un timeout de proxy) — no es un error de generación real, así
        // que no corresponde dejar un registro 'ERROR' en auditoría para esto.
        this.logger.warn(
          `Certificado y descarga ya registrados (descarga ${descarga.id}) pese al error posterior — no se registra como error de generación.`,
        );
      } else {
        // Registrar error en DescargasService
        await this.descargasService.registrarErrorDescarga({
          usuarioId: userId,
          error: error.message,
          ipOrigen: ip,
        });
      }

      // Si ya es un error de negocio conocido (ej. límite alcanzado, datos inválidos),
      // ese mensaje sí es seguro para el usuario; cualquier otra falla (AFIP, red,
      // parsing) se devuelve genérica — el detalle queda en el log y en `registrarErrorDescarga`.
      const mensajeSeguro =
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
          ? error.message
          : 'No se pudo generar el certificado. Intente nuevamente en unos minutos.';

      this.jobs.set(jobId, {
        userId,
        status: 'ERROR',
        mensajeError: mensajeSeguro,
        createdAt: Date.now(),
      });
      this.scheduleJobCleanup(jobId);
    }
  }
  /**
   * Validar configuración del servicio
   */
  async validarConfiguracion() {
    return this.afipService.validateConfiguration();
  }
}
