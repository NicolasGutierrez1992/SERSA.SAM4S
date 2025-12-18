import {
  Controller,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { CertificadoMaestroService } from '../certificado-maestro.service';
import { JwtAuthGuard } from '../../auth/guards/auth.guards';
import { RequireAuthenticated } from '../../auth/decorators/roles.decorator';

interface CertificateStatusPublicDto {
  existe: boolean;
  estado?: 'ACTIVO' | 'EXPIRADO' | 'PROXIMO_A_VENCER';
  diasParaVencer?: number;
  fechaVencimiento?: string;
  alertas?: string[];
  mensaje: string;
}

@ApiTags('Certificados Público')
@Controller('certificados-maestro')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class CertificadoPublicController {
  private readonly logger = new Logger(CertificadoPublicController.name);

  constructor(
    private readonly certificadoMaestroService: CertificadoMaestroService,
  ) {}

  /**
   * Obtener estado del certificado maestro
   * Accesible para cualquier usuario autenticado
   * Información pública (no sensible)
   */
  @Get('status')
  @RequireAuthenticated()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener estado del certificado',
    description:
      'Retorna el estado actual del certificado maestro. Accesible para todos los usuarios autenticados.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado del certificado',
    schema: {
      example: {
        existe: true,
        estado: 'ACTIVO',
        diasParaVencer: 245,
        fechaVencimiento: '2026-10-15T10:30:00Z',
        alertas: [],
        mensaje: 'Certificado activo y operativo',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Certificado no configurado',
  })
  async obtenerEstado(): Promise<CertificateStatusPublicDto> {
    try {
      const existe = await this.certificadoMaestroService.existeCertificadoMaestro();

      if (!existe) {
        return {
          existe: false,
          mensaje: 'Certificado maestro no configurado',
        };
      }

      const estado = await this.certificadoMaestroService.obtenerEstadoExpiración();

      let mensaje = '';
      switch (estado.estado) {
        case 'ACTIVO':
          mensaje = `Certificado activo. Vence en ${estado.diasParaVencer} días`;
          break;
        case 'PROXIMO_A_VENCER':
          mensaje = `⚠️ Certificado próximo a vencer en ${estado.diasParaVencer} días`;
          break;
        case 'EXPIRADO':
          mensaje = '❌ Certificado expirado. Contacte al administrador';
          break;
      }

      this.logger.debug(`Estado del certificado obtenido: ${estado.estado}`);

      return {
        existe: true,
        estado: estado.estado,
        diasParaVencer: estado.diasParaVencer,
        fechaVencimiento: estado.fechaVencimiento.toISOString(),
        alertas: estado.alertas,
        mensaje,
      };
    } catch (error) {
      this.logger.error('Error obteniendo estado del certificado', error);
      return {
        existe: false,
        mensaje: 'Error al obtener estado del certificado',
      };
    }
  }
}
