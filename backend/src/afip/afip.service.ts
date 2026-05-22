import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as soap from 'soap';
import * as forge from 'node-forge';
import { LoggerService } from '../common/logger.service';
import { CertificadoMaestroService } from '../certificados/certificado-maestro.service';
import { AfipFilesService } from './services/afip-files.service';
import { AppSettingsService } from '../common/services/app-settings.service';

export interface CertificadoRequest {
  marca: string;
  modelo: string;
  numeroSerie: string;
  cuit?: string;
}

export interface CertificadoResponse {
  certificadoPem: string;
  nombreArchivo: string;
  checksum: string;
  tamaño: number;
  logs: any[];
}

interface AfipConfig {
  wsaaUrl: string;
  wscertUrl: string;
  cuit: string;
  fabricante: string;
}

@Injectable()
export class AfipService {
  private readonly logger = new Logger(AfipService.name);

  // Cache de token AFIP (válido hasta expirationTime)
  private tokenCache: { token?: string; sign?: string; expirationTime?: Date } = {};

  constructor(
    private readonly configService: ConfigService,
    private readonly loggerService: LoggerService,
    private readonly certificadoMaestroService: CertificadoMaestroService,
    private readonly afipFilesService: AfipFilesService,
    private readonly appSettingsService: AppSettingsService,
  ) {
    this.loggerService.info('AFIP', 'AfipService inicializado — modo BD exclusivo');
  }

  /**
   * Lee la configuración AFIP desde app_settings (BD) con fallback a env vars.
   * Se llama de forma lazy dentro de cada método async para evitar problemas
   * de inicialización antes de que la BD esté lista.
   */
  private async obtenerConfigAfip(): Promise<AfipConfig> {
    const get = async (key: string): Promise<string> => {
      try {
        return await this.appSettingsService.obtenerSetting(key);
      } catch {
        return this.configService.get<string>(key) ?? '';
      }
    };

    const [wsaaUrl, wscertUrl, cuit, fabricante] = await Promise.all([
      get('AFIP_WSAA_URL'),
      get('AFIP_WSCERT_WSDL'),
      get('AFIP_CUIT'),
      get('AFIP_FABRICANTE'),
    ]);

    return { wsaaUrl, wscertUrl, cuit, fabricante };
  }

  /**
   * Generar certificado CRS - Versión PRODUCCIÓN
   */
  async generarCertificado(request: CertificadoRequest): Promise<CertificadoResponse> {
    const logs: any[] = [];
    this.loggerService.info('AFIP-generarCertificado', 'Iniciando proceso de certificado', request);

    const config = await this.obtenerConfigAfip();

    if (!config.cuit || !config.fabricante || !request.marca || !request.modelo || !request.numeroSerie) {
      this.loggerService.error('AFIP-generarCertificado', 'Faltan parámetros requeridos', request);
      throw new BadRequestException('Todos los parámetros son requeridos');
    }

    try {
      /*Descomentar para produccion
      logs.push({ timestamp: new Date().toISOString(), step: 'inicio', message: `CUIT: ${config.cuit}, Fabricante: ${config.fabricante}, Marca: ${request.marca}, Modelo: ${request.modelo}, Número de Serie: ${request.numeroSerie}` });
      // 1. Login WSAA para obtener token y sign
      this.loggerService.debug('AFIP-generarCertificado', 'Llamando a loginWsaa...');
      const { token, sign, expirationTime } = await this.loginWsaa(config);
      this.loggerService.info('AFIP-generarCertificado', 'Token y sign obtenidos', { token: token?.substring(0, 20), sign: sign?.substring(0, 20), expirationTime });
      logs.push({ timestamp: new Date().toISOString(), step: 'wsaa_login', message: 'Token y sign obtenidos' });

      // 2. Crear cliente SOAP y llamar a renovarCertificado
      this.loggerService.debug('AFIP-generarCertificado', 'Creando cliente SOAP...');
      const client = await soap.createClientAsync(config.wscertUrl);
      this.loggerService.info('AFIP-generarCertificado', 'Cliente SOAP creado');
      const args = {
        cuit: config.cuit,
        fabricante: config.fabricante,
        marca: request.marca,
        modelo: request.modelo,
        numeroSerie: request.numeroSerie,
        token,
        sign
      };
      this.loggerService.debug('AFIP-generarCertificado', 'Args para renovarCertificado', args);
      logs.push({ timestamp: new Date().toISOString(), step: 'wscert_args', message: 'Args para renovarCertificado', args });

      this.loggerService.debug('AFIP-generarCertificado', 'Llamando a renovarCertificado en el WS...');
      const [result] = await client.renovarCertificadoAsync(args);
      this.loggerService.info('AFIP-generarCertificado', 'Resultado de renovarCertificadoResponse', result);
      logs.push({ timestamp: new Date().toISOString(), step: 'wscert_result', message: 'Resultado de renovarCertificadoResponse', result });

      let buffer = '';
      if (result && result.return) {
        const rta = result.return;
        this.loggerService.info('AFIP-generarCertificado', 'Procesando respuesta del WS', rta);
        logs.push({ timestamp: new Date().toISOString(), step: 'wscert_response', message: 'Procesando respuesta del WS', rta });

        // Leer root RTI desde BD
        let rootFileRTI = '';
        try {
          const rootRtiBuffer = await this.afipFilesService.obtenerArchivoRootRTI();
          rootFileRTI = rootRtiBuffer.toString('utf8').replace(/\r?\n/g, '');
          this.loggerService.debug('AFIP-generarCertificado', 'Root RTI obtenido de BD correctamente', { size: rootFileRTI.length });
          logs.push({ timestamp: new Date().toISOString(), step: 'root_rti_bd', message: 'Root RTI obtenido de BD correctamente' });
        } catch (error) {
          this.loggerService.error('AFIP-generarCertificado', 'Error obteniendo Root RTI de BD', error);
          throw new BadRequestException('Root_RTI no disponible. Cargarlo desde el panel de administración.');
        }
        buffer = '-----BEGIN CMS-----\n';
        if (rootFileRTI) {
          let cadena = rootFileRTI;
          while (cadena.length > 64) {
            buffer += cadena.substring(0, 64) + "\n";
            cadena = cadena.substring(64);
          }
          buffer += cadena + "\n";
          buffer += "-----END CMS-----\n";
          this.loggerService.info('AFIP', 'Root Cert RTI OK', { numeroSerie: request.numeroSerie });
        }
        // Cadena de certificación[1]
        if (rta.cadenaCertificacion && rta.cadenaCertificacion[1]) {
          let cadena = rta.cadenaCertificacion[1].replace(/\r?\n/g, '');
          buffer += "-----BEGIN CERTIFICATE-----\n";
          while (cadena.length > 64) {
            buffer += cadena.substring(0, 64) + "\n";
            cadena = cadena.substring(64);
          }
          buffer += cadena + "\n";
          buffer += "-----END CERTIFICATE-----\n";
          this.loggerService.info('AFIP', '1º cert OK', { numeroSerie: request.numeroSerie });
        }
        // Certificado principal
        if (rta.certificado) {
          let cadena = rta.certificado.replace(/\r?\n/g, '');
          buffer += "-----BEGIN CERTIFICATE-----\n";
          while (cadena.length > 64) {
            buffer += cadena.substring(0, 64) + "\n";
            cadena = cadena.substring(64);
          }
          buffer += cadena + "\n";
          buffer += "-----END CERTIFICATE-----\n";
          this.loggerService.info('AFIP', '2º cert OK', { numeroSerie: request.numeroSerie });
        }
      }
      const nombreArchivo = this.generarNombreArchivo(request);
      const checksum = this.calcularChecksum(buffer);
      const tamaño = Buffer.byteLength(buffer, 'utf8');
      this.loggerService.info('AFIP-generarCertificado', 'Certificado CRS generado exitosamente', { archivo: nombreArchivo, tamaño, checksum });
      logs.push({ timestamp: new Date().toISOString(), step: 'completado', message: 'Certificado CRS generado exitosamente', archivo: nombreArchivo, tamaño, checksum });
      return { certificadoPem: buffer, nombreArchivo, checksum, tamaño, logs };
      */
      return {
        certificadoPem: 'PRODUCCIÓN DESHABILITADA',
        nombreArchivo: this.generarNombreArchivo(request),
        checksum: 'PRODUCCIÓN DESHABILITADA',
        tamaño: 0,
        logs
      };
    } catch (error) {
      this.loggerService.error('AFIP', 'Error generando certificado AFIP', error);
      logs.push({ timestamp: new Date().toISOString(), step: 'error', message: error.message, error: error.stack });
      throw new BadRequestException(`Error AFIP: ${error.message}`);
    }
  }

  /**
   * Login WSAA - Obtener token y sign de AFIP (lee PFX desde BD)
   */
  private async loginWsaa(config: AfipConfig): Promise<{ token: string; sign: string; expirationTime: Date }> {
    // Verificar cache
    if (this.tokenCache.token && this.tokenCache.expirationTime && new Date() < this.tokenCache.expirationTime) {
      this.loggerService.debug('AFIP-loginWsaa', 'Token cache válido');
      return {
        token: this.tokenCache.token,
        sign: this.tokenCache.sign,
        expirationTime: this.tokenCache.expirationTime
      };
    }

    try {
      // Obtener PFX y password desde BD
      this.loggerService.debug('AFIP-loginWsaa', 'Leyendo certificado desde BD');
      const certData = await this.certificadoMaestroService.obtenerCertificadoMaestro();
      const pfxBuffer = certData.pfx;
      const keyPassword = certData.password;
      this.loggerService.debug('AFIP-loginWsaa', 'Certificado obtenido de BD correctamente');

      const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, keyPassword);
      this.loggerService.debug('AFIP-loginWsaa', 'PFX parseado correctamente');

      const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const certBag = bags[forge.pki.oids.certBag][0];
      const certificate = certBag.cert;

      const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
      const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0];
      const privateKey = keyBag.key;

      const tra = this.crearTRA();
      const p7 = forge.pkcs7.createSignedData();
      p7.content = forge.util.createBuffer(tra);
      p7.addCertificate(certificate);
      p7.addSigner({
        key: privateKey,
        certificate: certificate,
        digestAlgorithm: forge.pki.oids.sha256
      });
      p7.sign();

      const cms = forge.asn1.toDer(p7.toAsn1()).getBytes();
      const cmsBase64 = forge.util.encode64(cms);

      this.loggerService.debug('AFIP-loginWsaa', 'Creando cliente SOAP', { wsaaUrl: config.wsaaUrl });
      const client = await soap.createClientAsync(config.wsaaUrl);
      const result = await client.loginCmsAsync({ in0: cmsBase64 });

      const xml = result[0].loginCmsReturn;
      const tokenMatch = xml.match(/<token>(.+?)<\/token>/);
      const signMatch = xml.match(/<sign>(.+?)<\/sign>/);
      const expirationMatch = xml.match(/<expirationTime>(.+?)<\/expirationTime>/);

      if (!tokenMatch || !signMatch) {
        throw new Error('Error parseando respuesta WSAA');
      }

      this.tokenCache = {
        token: tokenMatch[1],
        sign: signMatch[1],
        expirationTime: expirationMatch
          ? new Date(expirationMatch[1])
          : new Date(Date.now() + 12 * 60 * 60 * 1000)
      };

      return {
        token: this.tokenCache.token,
        sign: this.tokenCache.sign,
        expirationTime: this.tokenCache.expirationTime
      };
    } catch (error) {
      this.loggerService.error('AFIP-loginWsaa', 'Error en login WSAA', error);
      throw error;
    }
  }

  /**
   * Renovar certificado usando WSCert
   */
  private async renovarCertificado(
    request: CertificadoRequest,
    credentials: { token: string; sign: string },
    config: AfipConfig,
  ) {
    try {
      const client = await soap.createClientAsync(config.wscertUrl);
      const result = await client.renovarCertificadoAsync({
        Auth: {
          Token: credentials.token,
          Sign: credentials.sign,
          Cuit: config.cuit
        },
        parametros: {
          marca: request.marca,
          modelo: request.modelo,
          numeroSerie: request.numeroSerie,
          fabricante: config.fabricante
        }
      });
      return result[0];
    } catch (error) {
      this.logger.error('Error en WSCert renovarCertificado', error);
      throw error;
    }
  }

  /**
   * Crear TRA (Ticket Request Access)
   */
  private crearTRA(): string {
    const now = new Date();
    const uniqueId = Math.floor(now.getTime() / 1000);
    const from = new Date(now.getTime() - 600000);
    const to = new Date(now.getTime() + 600000);

    return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${from.toISOString()}</generationTime>
    <expirationTime>${to.toISOString()}</expirationTime>
  </header>
  <service>arbccf</service>
</loginTicketRequest>`;
  }

  /**
   * Generar nombre del archivo según nomenclatura SERSA
   * Ejemplo: SESHIA0000001371-2025-08-22.pem
   */
  private generarNombreArchivo(request: CertificadoRequest): string {
    const fecha = new Date().toISOString().split('T')[0];
    const numeroSeriePadded = request.numeroSerie.padStart(10, '0');
    return `SE${request.marca}${request.modelo}${numeroSeriePadded}-${fecha}.pem`;
  }

  /**
   * Calcular checksum SHA256
   */
  private calcularChecksum(contenido: string): string {
    return 'sha256:' + crypto.createHash('sha256').update(contenido).digest('hex');
  }

  /**
   * Validar configuración AFIP (lee de BD / env vars)
   */
  async validateConfiguration(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const config = await this.obtenerConfigAfip();
      if (!config.cuit) errors.push('AFIP_CUIT no configurado (configurar en app_settings)');
      if (!config.fabricante) errors.push('AFIP_FABRICANTE no configurado (configurar en app_settings)');
      if (!config.wsaaUrl) errors.push('AFIP_WSAA_URL no configurado (configurar en app_settings)');
      if (!config.wscertUrl) errors.push('AFIP_WSCERT_WSDL no configurado (configurar en app_settings)');

      // Verificar que exista certificado en BD
      const existeCert = await this.certificadoMaestroService.existeCertificadoMaestro();
      if (!existeCert) errors.push('Certificado PFX no cargado en base de datos (subir desde panel)');

      // Verificar que exista Root_RTI en BD
      const existeRootRti = await this.afipFilesService.existeArchivoRootRTI();
      if (!existeRootRti) errors.push('Root_RTI.txt no cargado en base de datos (subir desde panel)');
    } catch (error: any) {
      errors.push(`Error validando configuración: ${error?.message ?? String(error)}`);
    }

    this.loggerService.info('AFIP', `Configuración AFIP validada — ${errors.length === 0 ? 'OK' : 'Errores'}`, { errors });
    return { valid: errors.length === 0, errors };
  }
}
