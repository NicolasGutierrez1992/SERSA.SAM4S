import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as soap from 'soap';
import * as forge from 'node-forge';
import { LoggerService } from '../common/logger.service';

export interface CertificadoRequest {
  //controladorId: string;
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

@Injectable()
export class AfipService {
  private readonly logger = new Logger(AfipService.name);
  
  // Configuraciones AFIP desde .env
  private readonly wsaaUrl: string;
  private readonly wscertUrl: string;
  private readonly cuit: string;
  private readonly fabricante: string;
  private readonly certPath: string;
  private readonly keyPassword: string;
  private readonly rootPath: string;

  // Cache para tokens
  private tokenCache: { token?: string; sign?: string; expirationTime?: Date } = {};
  constructor(
    private configService: ConfigService,
    private loggerService: LoggerService
  ) {
    // Configuraciones desde .env
    this.wsaaUrl = this.configService.get('AFIP_WSAA_URL');
    this.wscertUrl = this.configService.get('AFIP_WSCERT_WSDL');
    this.cuit = this.configService.get('AFIP_CUIT');
    this.fabricante = this.configService.get('AFIP_FABRICANTE');
    
    // Resolver rutas relativas correctamente
    const certPathRaw = this.configService.get('AFIP_CERT_PATH');
    const rootPathRaw = this.configService.get('AFIP_ROOT_PATH');
    
    // Si la ruta es relativa, resolverla desde el directorio dist (en producción)
    // o desde src (en desarrollo)
    this.certPath = this.resolvePath(certPathRaw);
    this.rootPath = this.resolvePath(rootPathRaw);
      this.keyPassword = this.configService.get('AFIP_KEY_PASSWORD');
    
    this.loggerService.info('AFIP', 'AFIP Service initialized - PRODUCTION MODE');
    this.loggerService.info('AFIP', 'Rutas resueltas', { 
      certPathRaw: certPathRaw,
      certPath: this.certPath, 
      certExists: fs.existsSync(this.certPath),
      rootPathRaw: rootPathRaw,
      rootPath: this.rootPath,
      rootExists: fs.existsSync(this.rootPath),
      cwd: process.cwd(),
      env: process.env.NODE_ENV
    });
    this.validateConfiguration();
  }  /**
   * Resuelve rutas relativas correctamente en producción y desarrollo
   */
  private resolvePath(filePath: string): string {
    if (!filePath) return '';
    
    // Si es ruta absoluta, devolverla tal cual
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    
    // En producción (Railway), los archivos se copian a /app/certs
    // En desarrollo, están en backend/certs
    // Intentar buscar en múltiples ubicaciones
    const baseDir = process.cwd();
    const cleanPath = filePath.replace('backend/', '');
    
    const possiblePaths = [
      // Opción 1: Ruta relativa desde cwd actual
      path.resolve(baseDir, filePath),
      // Opción 2: Si la ruta incluye 'backend/', buscar sin 'backend/'
      filePath.includes('backend/') 
        ? path.resolve(baseDir, cleanPath)
        : null,
      // Opción 3: En /app/certs (Railway - sin backend/)
      path.resolve('/app', cleanPath),
      // Opción 4: Desde /app/backend (si está ahí)
      path.resolve('/app/backend', cleanPath),
    ].filter((p): p is string => Boolean(p));
    
    // Buscar el primer archivo que exista
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        return possiblePath;
      }
    }
    
    // Si no encuentra ninguno, devolver el que tiene mejor probabilidad
    // Preferir /app/certs en producción
    return possiblePaths.find(p => p.includes('/app/')) || possiblePaths[0] || filePath;
  }
  /**
   * Generar certificado CRS - Versión PRODUCCIÓN
   */
  async generarCertificado(request: CertificadoRequest): Promise<CertificadoResponse> {
    const logs: any[] = [];
    this.loggerService.info('AFIP-generarCertificado', 'Iniciando proceso de certificado', request);

    // Validación de parámetros
    if (!this.cuit || !this.fabricante || !request.marca || !request.modelo || !request.numeroSerie) {
      this.loggerService.error('AFIP-generarCertificado', 'Faltan parámetros requeridos', request);
      throw new BadRequestException('Todos los parámetros son requeridos');
    }

    try {
      logs.push({ timestamp: new Date().toISOString(), step: 'inicio', message: `CUIT: ${this.cuit}, Fabricante: ${this.fabricante}, Marca: ${request.marca}, Modelo: ${request.modelo}, Número de Serie: ${request.numeroSerie}` });
      // 1. Login WSAA para obtener token y sign
      this.loggerService.debug('AFIP-generarCertificado', 'Llamando a loginWsaa...');
      const { token, sign, expirationTime } = await this.loginWsaa();
      this.loggerService.info('AFIP-generarCertificado', 'Token y sign obtenidos', { token: token?.substring(0, 20), sign: sign?.substring(0, 20), expirationTime });
      logs.push({ timestamp: new Date().toISOString(), step: 'wsaa_login', message: 'Token y sign obtenidos' });

      // 2. Crear cliente SOAP y llamar a renovarCertificado
      this.loggerService.debug('AFIP-generarCertificado', 'Creando cliente SOAP...');
      const client = await soap.createClientAsync(this.wscertUrl);
      this.loggerService.info('AFIP-generarCertificado', 'Cliente SOAP creado');
      const args = {
        cuit: this.cuit,
        fabricante: this.fabricante,
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

      let buffer = '';      if (result && result.return) {
        const rta = result.return;
        this.loggerService.info('AFIP-generarCertificado', 'Procesando respuesta del WS', rta);
        logs.push({ timestamp: new Date().toISOString(), step: 'wscert_response', message: 'Procesando respuesta del WS', rta });
        // Leer root RTI
        const rootExists = this.rootPath && fs.existsSync(this.rootPath);
        this.loggerService.debug('AFIP-generarCertificado', 'Verificando Root RTI', { 
          rootPath: this.rootPath, 
          exists: rootExists,
          cwd: process.cwd()
        });
        const rootFileRTI = rootExists ? fs.readFileSync(this.rootPath, 'utf8').replace(/\r?\n/g, '') : '';
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
      // Nombre de archivo y checksum
      const nombreArchivo = this.generarNombreArchivo(request);
      const checksum = this.calcularChecksum(buffer);
      const tamaño = Buffer.byteLength(buffer, 'utf8');
      this.loggerService.info('AFIP-generarCertificado', 'Certificado CRS generado exitosamente', { archivo: nombreArchivo, tamaño, checksum });
      logs.push({ timestamp: new Date().toISOString(), step: 'completado', message: 'Certificado CRS generado exitosamente', archivo: nombreArchivo, tamaño, checksum });
      return {
        certificadoPem: buffer,
        nombreArchivo,
        checksum,
        tamaño,
        logs
      };
    } catch (error) {
      this.loggerService.error('AFIP', 'Error generando certificado AFIP', error);
      logs.push({ timestamp: new Date().toISOString(), step: 'error', message: error.message, error: error.stack });
      throw new BadRequestException(`Error AFIP: ${error.message}`);
    }
  }

  /**
   * Login WSAA - Obtener token y sign de AFIP
   */
  private async loginWsaa(): Promise<{ token: string; sign: string; expirationTime: Date }> {
    this.loggerService.debug('AFIP-loginWsaa', 'Inicio loginWsaa()', {
      certPath: this.certPath,
      keyPassword: this.keyPassword,
      wsaaUrl: this.wsaaUrl
    });
    // Verificar cache de token
    this.loggerService.debug('AFIP-loginWsaa', 'Verificando cache de token', this.tokenCache);
    if (this.tokenCache.token && this.tokenCache.expirationTime &&
        new Date() < this.tokenCache.expirationTime) {
      this.loggerService.debug('AFIP-loginWsaa', 'Token cache válido', {
        token: this.tokenCache.token?.substring(0, 20),
        sign: this.tokenCache.sign?.substring(0, 20),
        expirationTime: this.tokenCache.expirationTime
      });
      return {
        token: this.tokenCache.token,
        sign: this.tokenCache.sign,
        expirationTime: this.tokenCache.expirationTime
      };
    }    try {
      this.loggerService.debug('AFIP-loginWsaa', 'Leyendo archivo PFX', { 
        certPath: this.certPath,
        exists: fs.existsSync(this.certPath),
        cwd: process.cwd()
      });
      if (!fs.existsSync(this.certPath)) {
        this.loggerService.error('AFIP-loginWsaa', 'Certificado PFX no encontrado', { 
          certPath: this.certPath,
          exists: false,
          cwd: process.cwd()
        });
        throw new Error(`Certificado PFX no encontrado: ${this.certPath}`);
      }
      const pfxBuffer = fs.readFileSync(this.certPath);
      this.loggerService.debug('AFIP-loginWsaa', 'Archivo PFX leído correctamente', { size: pfxBuffer.length });
      const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, this.keyPassword);
      this.loggerService.debug('AFIP-loginWsaa', 'PFX parseado correctamente');

      // Extraer certificado y clave privada
      const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const certBag = bags[forge.pki.oids.certBag][0];
      const certificate = certBag.cert;
      this.loggerService.debug('AFIP-loginWsaa', 'Certificado extraído', { subject: certificate.subject.attributes });

      const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
      const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0];
      const privateKey = keyBag.key;
      this.loggerService.debug('AFIP-loginWsaa', 'Clave privada extraída');

      // Crear TRA (Ticket Request Access)
      const tra = this.crearTRA();
      this.loggerService.debug('AFIP-loginWsaa', 'TRA generado', { tra });
      
      // Firmar TRA con certificado
      const p7 = forge.pkcs7.createSignedData();
      p7.content = forge.util.createBuffer(tra);
      p7.addCertificate(certificate);
      p7.addSigner({
        key: privateKey,
        certificate: certificate,
        digestAlgorithm: forge.pki.oids.sha256
      });
      p7.sign();
      this.loggerService.debug('AFIP-loginWsaa', 'TRA firmado correctamente');

      const cms = forge.asn1.toDer(p7.toAsn1()).getBytes();
      const cmsBase64 = forge.util.encode64(cms);
      this.loggerService.debug('AFIP-loginWsaa', 'CMS generado y codificado en base64', { cmsBase64: cmsBase64.substring(0, 40) + '...' });

      // Llamar a WSAA
      this.loggerService.debug('AFIP-loginWsaa', 'Creando cliente SOAP', { wsaaUrl: this.wsaaUrl });
      const client = await soap.createClientAsync(this.wsaaUrl);
      this.loggerService.debug('AFIP-loginWsaa', 'Cliente SOAP creado');
      const result = await client.loginCmsAsync({
        in0: cmsBase64
      });
      this.loggerService.debug('AFIP-loginWsaa', 'Respuesta de loginCmsAsync recibida', { result });

      // Parsear respuesta XML
      const xml = result[0].loginCmsReturn;
      this.loggerService.debug('AFIP-loginWsaa', 'XML recibido', { xml: xml.substring(0, 200) + '...' });
      const tokenMatch = xml.match(/<token>(.+?)<\/token>/);
      const signMatch = xml.match(/<sign>(.+?)<\/sign>/);
      const expirationMatch = xml.match(/<expirationTime>(.+?)<\/expirationTime>/);

      if (!tokenMatch || !signMatch) {
        this.loggerService.error('AFIP-loginWsaa', 'Error parseando respuesta WSAA', { xml });
        throw new Error('Error parseando respuesta WSAA');
      }

      // Cachear token
      this.tokenCache = {
        token: tokenMatch[1],
        sign: signMatch[1],
        expirationTime: expirationMatch ? new Date(expirationMatch[1]) : new Date(Date.now() + 12 * 60 * 60 * 1000)
      };
      this.loggerService.debug('AFIP-loginWsaa', 'Token cacheado', this.tokenCache);

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
  private async renovarCertificado(request: CertificadoRequest, credentials: { token: string; sign: string }) {
    try {
      const client = await soap.createClientAsync(this.wscertUrl);
      
      const result = await client.renovarCertificadoAsync({
        Auth: {
          Token: credentials.token,
          Sign: credentials.sign,
          Cuit: this.cuit
        },
        parametros: {
          marca: request.marca,
          modelo: request.modelo,
          numeroSerie: request.numeroSerie,
          fabricante: this.fabricante
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
    const from = new Date(now.getTime() - 600000); // 10 minutos antes
    const to = new Date(now.getTime() + 600000);   // 10 minutos después

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
   * Construir certificado PEM completo
   */
  private construirCertificadoPem(certificadoData: any): string {
    // Leer certificado raíz RTI
    const rootRTI = fs.readFileSync(this.rootPath, 'utf8');
    
    // Construir certificado completo según especificación AFIP
    return `${rootRTI}
${certificadoData.certificado || ''}`;
  }

 
  /**
   * Generar nombre del archivo según nomenclatura SERSA
   * Ejemplo: SESHIA0000001371-2025-08-22.pem
   */
  private generarNombreArchivo(request: CertificadoRequest): string {
    const fecha = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
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
   * Validar configuración AFIP
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.cuit) errors.push('AFIP_CUIT no configurado');
    if (!this.fabricante) errors.push('AFIP_FABRICANTE no configurado');
    if (!this.wsaaUrl) errors.push('AFIP_WSAA_URL no configurado');
    if (!this.wscertUrl) errors.push('AFIP_WSCERT_WSDL no configurado');
    if (!this.certPath) errors.push('AFIP_CERT_PATH no configurado');
    if (!this.keyPassword) errors.push('AFIP_KEY_PASSWORD no configurado');
    if (!this.rootPath) errors.push('AFIP_ROOT_PATH no configurado');

    // Verificar existencia de archivos
    if (this.certPath && !fs.existsSync(this.certPath)) {
      errors.push(`Certificado PFX no encontrado: ${this.certPath}`);
    }
    if (this.rootPath && !fs.existsSync(this.rootPath)) {
      errors.push(`Certificado Root RTI no encontrado: ${this.rootPath}`);
    }

    this.logger.log(`Configuración AFIP validada - ${errors.length === 0 ? 'OK' : 'Errores encontrados'}`);
    
    if (errors.length > 0) {
      this.logger.warn(`Errores de configuración AFIP: ${errors.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}