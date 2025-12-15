import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AfipService } from '../afip/afip.service';
import { DescargasService } from '../descargas/descargas.service';
import { TimezoneService } from '../common/timezone.service';
import { Certificado } from './entities/certificado.entity';
import * as fs from 'fs';
import * as path from 'path';
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
export class CertificadosService {  private readonly logger = new Logger(CertificadosService.name);
  constructor(
    @InjectRepository(Certificado)
    private readonly certificadoRepository: Repository<Certificado>,
    private readonly afipService: AfipService,
    private readonly descargasService: DescargasService,
    private readonly timezoneService: TimezoneService,
  ) {
    this.logger.log('CertificadosService initialized - Pure certificate generation');
  }
  /**
   * Generar certificado CRS usando AFIP
   * Delega el registro de descarga al DescargasService
   */
  async generarCertificado(
    userId: number,
    datos: GenerarCertificadoDto,
    ip?: string
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
      throw new BadRequestException('El número de serie debe contener solo dígitos numéricos');
    }
    
    const numeroSerieNormalizado = numeroSerie.padStart(10, '0');
    if (numeroSerieNormalizado.length > 10) {
      throw new BadRequestException('El número de serie no puede tener más de 10 dígitos');
    }    try {
      this.logger.log(`Generando certificado para usuario ${userId}: ${marca} ${modelo} - ${numeroSerieNormalizado}`);
      
      // Generar ID del certificado con formato: "SESHIA-0000001234"
      const idCertificado = `SE${marca}${modelo}-${numeroSerieNormalizado}`;
      
      // Verificar si el certificado ya existe
      let certificado = await this.certificadoRepository.findOne({
        where: { id_certificado: idCertificado }
      });
      
      // Generar certificado usando AFIP
      const certificadoAfip = await this.afipService.generarCertificado({
        marca,
        modelo,
        numeroSerie: numeroSerieNormalizado
      });
    
      if (!certificado) {        
        this.logger.log(`Certificado almacenado en DB: ${certificadoAfip.nombreArchivo}`);
        this.logger.log(`Certificado almacenado en DB: ${certificadoAfip.certificadoPem}`);
        this.logger.log(`Certificado almacenado en DB: ${certificadoAfip.tamaño}`);
        // TODO - Analizar donde se almacenan los logs
        this.logger.log(`Certificado almacenado en DB: ${certificadoAfip.logs}`);
        
        // Crear registro en certificados_v2
        certificado = this.certificadoRepository.create({
          id_certificado: idCertificado,
          fabricante: 'SE',
          marca,
          modelo,
          numero_serie: numeroSerieNormalizado,
          metadata: certificadoAfip.certificadoPem,            
          archivo_referencia: certificadoAfip.nombreArchivo
        });
        
        await this.certificadoRepository.save(certificado);
        this.logger.log(`Certificado almacenado en DB: ${idCertificado}`);      } else {
        // Actualizar timestamp de updated_at y el metadata del certificado
        certificado.metadata = certificadoAfip.certificadoPem;
        // Usar fecha actual en zona horaria de Argentina (se almacena en UTC)
        certificado.updated_at = new Date();
        await this.certificadoRepository.save(certificado);
        this.logger.log(`Certificado existente actualizado: ${idCertificado}`);
      }

      // Registrar descarga usando DescargasService
      const descarga = await this.descargasService.registrarDescarga({
        usuarioId: userId,
        controladorId: idCertificado,
        certificadoNombre: certificado.archivo_referencia,
        tamaño: certificadoAfip.tamaño,
        ipOrigen: ip
      });      this.logger.log(`Descarga registrada exitosamente: ${descarga.id}`);
      
      // ⭐ Validar si la suma de descargas pendientes supera el notification_limit del mayorista
      const idMayorista = await this.descargasService.obtenerIdMayoristaPorUsuario(userId);
      if(idMayorista != 1){
        const pendingDownloads = await this.descargasService.contarDescargasPendientesMayorista(idMayorista);
        // ⭐ NUEVO: Obtener notification_limit desde la BD (usuario mayorista con rol=2)
        const notificationLimit = await this.descargasService.obtenerNotificationLimitMayorista(idMayorista);
        
        this.logger.warn(`Cantidad de descargas pendientes del mayorista ${idMayorista}: ${pendingDownloads}`);
        this.logger.warn(`Límite de notificación configurado: ${notificationLimit}`);      
        
        if (pendingDownloads >= notificationLimit) {
          this.logger.warn(`El mayorista ${idMayorista} ha superado el límite configurado en notificaciones (${notificationLimit})`);
          // Notificación vía email a facturación
          await this.descargasService.notificarExcesoDescargasMayorista(idMayorista, pendingDownloads);
        }
      }
      
      return {
        downloadId: descarga.id.toString(),
        filename: certificado.archivo_referencia,
        size: certificado.metadata?.tamaño || 0,
        checksum: certificado.metadata?.checksum || ''
      };

    } catch (error) {
      this.logger.error(`Error generando certificado para usuario ${userId}:`, error);
      
      // Registrar error en DescargasService
      await this.descargasService.registrarErrorDescarga({
        usuarioId: userId,
        error: error.message,
        ipOrigen: ip
      });
      
      throw new BadRequestException(`Error generando certificado: ${error.message}`);
    }
  }

  /**
   * Validar configuración del servicio
   */
  async validarConfiguracion() {
    return this.afipService.validateConfiguration();
  }

  
async guardarArchivosCert(files: { certificado?: any[], pwrCst?: any[], rootRti?: any[] }) {
  const certsPath = path.join(__dirname, '../../certs');
  console.log('Guardando archivos en:', certsPath);
  if (files.certificado && files.certificado[0]) {
    const certPath = files.certificado[0].path;
    const certBuffer = fs.readFileSync(certPath);
    fs.writeFileSync(path.join(certsPath, 'certificado.pfx'), certBuffer);
  }
  if (files.pwrCst && files.pwrCst[0]) {
    const pwrPath = files.pwrCst[0].path;
    const pwrBuffer = fs.readFileSync(pwrPath);
    fs.writeFileSync(path.join(certsPath, 'pwrCst.txt'), pwrBuffer);
  }
  if (files.rootRti && files.rootRti[0]) {
    const rootPath = files.rootRti[0].path;
    const rootBuffer = fs.readFileSync(rootPath);
    fs.writeFileSync(path.join(certsPath, 'Root_RTI.txt'), rootBuffer);
  }
}
}