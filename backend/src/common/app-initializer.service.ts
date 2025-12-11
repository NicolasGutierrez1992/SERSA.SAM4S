import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CertificadoMigrationService } from './certificado-migration.service';
import { TimezoneService } from './timezone.service';

/**
 * Inicializador de aplicación
 * Se ejecuta automáticamente al iniciar la aplicación
 */
@Injectable()
export class AppInitializerService implements OnModuleInit {
  private readonly logger = new Logger(AppInitializerService.name);
  private readonly timezoneService = new TimezoneService();

  constructor(
    private configService: ConfigService,
    private certificadoMigrationService: CertificadoMigrationService,
  ) {}
  async onModuleInit(): Promise<void> {
    // Registrar hora de inicialización en zona horaria de Argentina
    const horaArgentina = this.timezoneService.formatDateTimeFull(new Date());
    this.logger.log(`Inicializando servicios de aplicación... [${horaArgentina}]`);

    // Ejecutar migración de certificado si es necesaria
    try {
      const usarBdParaCertificado = this.configService.get('USAR_BD_PARA_CERTIFICADO', true);
      
      if (usarBdParaCertificado === 'true' || usarBdParaCertificado === true) {
        const certPath = this.resolvePath(
          this.configService.get('AFIP_CERT_PATH')
        );
        const keyPassword = this.configService.get('AFIP_KEY_PASSWORD');
        const cuit = this.configService.get('AFIP_CUIT');

        this.logger.log('Ejecutando migración de certificado maestro...');
        await this.certificadoMigrationService.migrarSiEsNecesario(
          certPath,
          keyPassword,
          cuit,
        );
      }
    } catch (error) {
      this.logger.error('Error durante inicialización de servicios', error);
      // No lanzar error, permitir que la app continúe
    }

    this.logger.log('Inicialización de servicios completada');
  }

  /**
   * Resolver rutas relativas (copia de lógica de AfipService)
   */
  private resolvePath(filePath: string): string {
    if (!filePath) return '';
    
    const path = require('path');
    const fs = require('fs');

    if (path.isAbsolute(filePath)) {
      return filePath;
    }

    const baseDir = process.cwd();
    const cleanPath = filePath.replace('backend/', '');

    const possiblePaths = [
      path.resolve(baseDir, filePath),
      filePath.includes('backend/')
        ? path.resolve(baseDir, cleanPath)
        : null,
      path.resolve('/app', cleanPath),
      path.resolve('/app/backend', cleanPath),
    ].filter((p): p is string => Boolean(p));

    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        return possiblePath;
      }
    }

    return possiblePaths.find(p => p.includes('/app/')) || possiblePaths[0] || filePath;
  }
}
