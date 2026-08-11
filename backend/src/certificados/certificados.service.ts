import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class CertificadosService {
  private readonly logger = new Logger(CertificadosService.name);
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
   * Generar certificado CRS usando AFIP
   * Delega el registro de descarga al DescargasService
   */
  async generarCertificado(
    userId: number,
    datos: GenerarCertificadoDto,
    ip?: string,
  ): Promise<CertificadoGeneradoResponse> {
    // ⭐ NUEVA: Validar si el usuario puede descargar
    const validacion = await this.descargasService.canUserDownload(userId);
    if (!validacion.canDownload) {
      throw new BadRequestException(validacion.message);
    }

    // Validar parámetros de entrada
    const { marca, modelo, numeroSerie } = datos;

    // Validar marca (siempre debe ser "SH")
    if (marca !== 'SH') {
      throw new BadRequestException('La marca debe ser "SH"');
    }

    // Validar modelo (debe ser "IA" o "RA")
    if (!['IA', 'RA'].includes(modelo)) {
      throw new BadRequestException('El modelo debe ser "IA" o "RA"');
    }

    // Validar y normalizar número de serie (10 dígitos numéricos, completar con ceros a la izquierda)
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
    // Se declara afuera del try para poder consultarla desde el catch: si ya
    // se llegó a crear, la generación en sí fue exitosa aunque algo posterior
    // (ej. notificaciones, o un timeout de proxy) haya hecho fallar la respuesta HTTP.
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

      return {
        downloadId: descarga.id.toString(),
        filename: certificado.archivo_referencia,
        size: certificado.metadata?.tamaño || 0,
        checksum: certificado.metadata?.checksum || '',
      };
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
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException(
        'No se pudo generar el certificado. Intente nuevamente en unos minutos.',
      );
    }
  }
  /**
   * Validar configuración del servicio
   */
  async validarConfiguracion() {
    return this.afipService.validateConfiguration();
  }
}
