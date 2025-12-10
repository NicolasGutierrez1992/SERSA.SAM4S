import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CertificadoMaestro } from '../certificados/entities/certificado-maestro.entity';
import { CertificadoMaestroService } from '../certificados/certificado-maestro.service';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Servicio para migrar certificado .pfx desde archivo físico a base de datos
 * Se ejecuta una sola vez durante la inicialización de la aplicación
 */
@Injectable()
export class CertificadoMigrationService {
  private readonly logger = new Logger(CertificadoMigrationService.name);

  constructor(
    @InjectRepository(CertificadoMaestro)
    private readonly certificadoMaestroRepository: Repository<CertificadoMaestro>,
    private readonly certificadoMaestroService: CertificadoMaestroService,
  ) {}

  /**
   * Ejecutar migración si es necesaria
   * Verifica si existe certificado en archivo y BD está vacía, luego migra
   */
  async migrarSiEsNecesario(certPath: string, keyPassword: string, cuit?: string): Promise<void> {
    try {
      this.logger.log('Verificando si es necesaria migración de certificado...');

      // Verificar si ya existe en BD
      const existeEnBd = await this.certificadoMaestroRepository.findOne({
        where: { id: 'AFIP_PRINCIPAL' },
      });

      if (existeEnBd) {
        this.logger.log('Certificado maestro ya existe en BD, no es necesaria migración');
        return;
      }

      // Verificar si existe archivo
      if (!fs.existsSync(certPath)) {
        this.logger.warn(`Archivo de certificado no encontrado: ${certPath}. Migración no realizada.`);
        return;
      }

      this.logger.log(`Iniciando migración de certificado desde: ${certPath}`);

      // Migrar desde archivo
      const resultado = await this.certificadoMaestroService.cargarCertificadoDesdeArchivo(
        certPath,
        keyPassword,
        cuit,
      );

      this.logger.log('Certificado migrado exitosamente a base de datos', resultado);
    } catch (error) {
      this.logger.error('Error durante migración de certificado', error);
      // No lanzar error, permitir que la app continúe (puede que el usuario cargue después)
    }
  }
}
