import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Multer } from 'multer';
import { CertificadoMaestro } from './entities/certificado-maestro.entity';
import { EncryptionService } from '../common/encryption.service';
import { TimezoneService } from '../common/timezone.service';
import * as fs from 'fs';
import * as forge from 'node-forge';

interface UploadCertificadoMaestroDto {
  pfxFile: Multer.File;
  password: string;
  certificado_identificador?: string;
}

interface MetadataCertificado {
  subject?: string;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  thumbprint?: string;
  [key: string]: any;
}

@Injectable()
export class CertificadoMaestroService {  private readonly logger = new Logger(CertificadoMaestroService.name);
  private readonly CERTIFICADO_ID = 'AFIP_PRINCIPAL';

  constructor(
    @InjectRepository(CertificadoMaestro)
    private readonly certificadoMaestroRepository: Repository<CertificadoMaestro>,
    private readonly encryptionService: EncryptionService,
    private readonly timezoneService: TimezoneService,
  ) {}

  /**
   * Obtener el certificado maestro (desencriptado)
   * @returns Buffer con el archivo .pfx
   */
  async obtenerCertificadoMaestro(): Promise<{
    pfx: Buffer;
    password: string;
    metadata?: MetadataCertificado;
  }> {
    try {
      const certificado = await this.certificadoMaestroRepository.findOne({
        where: { id: this.CERTIFICADO_ID, activo: true },
      });

      if (!certificado) {
        this.logger.error('Certificado maestro no encontrado o inactivo');
        throw new NotFoundException(
          'Certificado maestro no configurado. Por favor, cargue un certificado .pfx.',
        );
      }

      // Desencriptar la contraseña
      const password = this.encryptionService.decrypt(certificado.password_encriptada);

      return {
        pfx: certificado.pfx_data,
        password,
        metadata: certificado.metadata,
      };
    } catch (error) {
      this.logger.error('Error obteniendo certificado maestro', error);
      throw error;
    }
  }

  /**
   * Verificar si existe un certificado maestro configurado
   */
  async existeCertificadoMaestro(): Promise<boolean> {
    try {
      const certificado = await this.certificadoMaestroRepository.findOne({
        where: { id: this.CERTIFICADO_ID, activo: true },
      });
      return !!certificado;
    } catch (error) {
      this.logger.error('Error verificando existencia de certificado maestro', error);
      return false;
    }
  }

  /**
   * Cargar un nuevo certificado maestro
   */
  async cargarCertificadoMaestro(
    dto: UploadCertificadoMaestroDto,
  ): Promise<{ mensaje: string; certificado_id: string }> {
    try {
      const { pfxFile, password, certificado_identificador } = dto;

      if (!pfxFile || !password) {
        throw new BadRequestException('Archivo PFX y contraseña son requeridos');
      }

      this.logger.log('Iniciando carga de certificado maestro');

      // Validar que sea un archivo .pfx
      if (!pfxFile.originalname.toLowerCase().endsWith('.pfx')) {
        throw new BadRequestException('El archivo debe ser un certificado .pfx válido');
      }

      // Parsear y validar el archivo PFX
      const metadata = await this.extraerMetadatos(pfxFile.buffer, password);

      // Encriptar la contraseña
      const passwordEncriptada = this.encryptionService.encrypt(password);

      // Buscar si ya existe un certificado maestro
      let certificado = await this.certificadoMaestroRepository.findOne({
        where: { id: this.CERTIFICADO_ID },
      });      if (certificado) {
        // Actualizar certificado existente
        this.logger.log('Actualizando certificado maestro existente');
        certificado.pfx_data = pfxFile.buffer;
        certificado.password_encriptada = passwordEncriptada;
        certificado.metadata = metadata;
        certificado.certificado_identificador = certificado_identificador;
        certificado.activo = true;
        // Usar fecha actual en zona horaria de Argentina (se almacena en UTC)
        certificado.uploaded_at = new Date();
        certificado.updated_at = new Date();
      } else {
        // Crear nuevo certificado maestro
        this.logger.log('Creando nuevo certificado maestro');
        certificado = this.certificadoMaestroRepository.create({
          id: this.CERTIFICADO_ID,
          pfx_data: pfxFile.buffer,
          password_encriptada: passwordEncriptada,
          metadata,
          certificado_identificador,
          activo: true,
          // Usar fecha actual en zona horaria de Argentina (se almacena en UTC)
          uploaded_at: new Date(),
        });
      }

      await this.certificadoMaestroRepository.save(certificado);

      this.logger.log('Certificado maestro cargado exitosamente', {
        subject: metadata.subject,
        validFrom: metadata.validFrom,
        validTo: metadata.validTo,
      });

      return {
        mensaje: 'Certificado maestro cargado exitosamente',
        certificado_id: this.CERTIFICADO_ID,
      };
    } catch (error) {
      this.logger.error('Error cargando certificado maestro', error);
      throw error;
    }
  }

  /**
   * Extraer metadatos del certificado PFX
   */
  private async extraerMetadatos(
    pfxBuffer: Buffer,
    password: string,
  ): Promise<MetadataCertificado> {
    try {
      const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

      // Extraer certificado
      const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const certBag = bags[forge.pki.oids.certBag][0];
      const certificate = certBag.cert;

      // Formatear información del certificado
      const metadata: MetadataCertificado = {
        subject: this.formatarDistinguishedName(certificate.subject.attributes),
        issuer: this.formatarDistinguishedName(certificate.issuer.attributes),
        validFrom: certificate.validity.notBefore.toISOString(),
        validTo: certificate.validity.notAfter.toISOString(),
        thumbprint: this.calcularThumbprint(certificate),
      };

      return metadata;
    } catch (error) {
      this.logger.error('Error extrayendo metadatos del certificado', error);
      throw new BadRequestException(
        'No se pudo procesar el certificado PFX. Verifique que la contraseña sea correcta.',
      );
    }
  }

  /**
   * Formatear Distinguished Name a string legible
   */
  private formatarDistinguishedName(attributes: any[]): string {
    return attributes
      .map((attr) => {
        const name = forge.pki.oids[attr.name] || attr.name;
        return `${name}=${attr.value}`;
      })
      .join(', ');
  }

  /**
   * Calcular thumbprint del certificado
   */
  private calcularThumbprint(cert: any): string {
    const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
    const hash = forge.sha1.create().update(der).digest().toHex();
    return hash;
  }

  /**
   * Obtener información del certificado maestro (sin desencriptar la contraseña)
   */
  async obtenerInfoCertificadoMaestro(): Promise<{
    existe: boolean;
    id?: string;
    certificado_identificador?: string;
    metadata?: MetadataCertificado;
    activo?: boolean;
    uploaded_at?: Date;
    updated_at?: Date;
  }> {
    try {
      const certificado = await this.certificadoMaestroRepository.findOne({
        where: { id: this.CERTIFICADO_ID },
      });

      if (!certificado) {
        return { existe: false };
      }

      return {
        existe: true,
        id: certificado.id,
        certificado_identificador: certificado.certificado_identificador,
        metadata: certificado.metadata,
        activo: certificado.activo,
        uploaded_at: certificado.uploaded_at,
        updated_at: certificado.updated_at,
      };
    } catch (error) {
      this.logger.error('Error obteniendo información del certificado maestro', error);
      throw error;
    }
  }

  /**
   * Cargar certificado desde archivo físico (para migración)
   * @param filePath Ruta al archivo .pfx
   * @param password Contraseña del certificado
   * @param certificado_identificador Identificador opcional (CUIT)
   */
  async cargarCertificadoDesdeArchivo(
    filePath: string,
    password: string,
    certificado_identificador?: string,
  ): Promise<{ mensaje: string; certificado_id: string }> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new BadRequestException(`Archivo no encontrado: ${filePath}`);
      }      const pfxBuffer = fs.readFileSync(filePath);

      return await this.cargarCertificadoMaestro({
        pfxFile: {
          buffer: pfxBuffer,
          originalname: 'certificado.pfx',
        } as Multer.File,
        password,
        certificado_identificador,
      });
    } catch (error) {
      this.logger.error('Error cargando certificado desde archivo', error);
      throw error;
    }
  }
}
