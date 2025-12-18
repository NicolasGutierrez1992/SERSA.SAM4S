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
import { RequireAdmin } from '../../auth/decorators/roles.decorator';

interface CertificateStatusDto {
  existe: boolean;
  estado?: 'ACTIVO' | 'EXPIRADO' | 'PROXIMO_A_VENCER';
  diasParaVencer?: number;
  fechaVencimiento?: string;
  metadata?: {
    subject?: string;
    issuer?: string;
    validFrom?: string;
    validTo?: string;
    thumbprint?: string;
  };
  alertas?: string[];
  uploaded_at?: string;
  updated_at?: string;
}

interface AdminDashboardDto {
  certificados: {
    principal: CertificateStatusDto;
  };
  salud: {
    rootRtiConfigurado: boolean;
    certificadoMaestroConfigurado: boolean;
  };
  alertas: string[];
}

@ApiTags('Certificados Admin')
@Controller('certificados-maestro/admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@RequireAdmin()
export class CertificadoAdminController {
  private readonly logger = new Logger(CertificadoAdminController.name);

  constructor(private readonly certificadoMaestroService: CertificadoMaestroService) {}

  /**
   * Obtener estado del certificado maestro
   * Solo administradores
   */
  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener estado del certificado maestro',
    description:
      'Retorna el estado de validez, expiración y alertas del certificado maestro. Solo administradores pueden acceder.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado del certificado maestro',
    schema: {
      example: {
        existe: true,
        estado: 'ACTIVO',
        diasParaVencer: 45,
        fechaVencimiento: '2025-12-31T00:00:00.000Z',
        alertas: ['✅ Certificado vigente. Vencimiento en 45 días'],
      },
    },
  })
  async obtenerStatus(): Promise<CertificateStatusDto> {
    try {
      const info = await this.certificadoMaestroService.obtenerInfoCertificadoMaestro();

      if (!info.existe) {
        return {
          existe: false,
        };
      }

      const estado = await this.certificadoMaestroService.obtenerEstadoExpiración();

      return {
        existe: true,
        estado: estado.estado,
        diasParaVencer: estado.diasParaVencer,
        fechaVencimiento: estado.fechaVencimiento.toISOString(),
        metadata: info.metadata,
        alertas: estado.alertas,
        uploaded_at: info.uploaded_at?.toISOString(),
        updated_at: info.updated_at?.toISOString(),
      };
    } catch (error) {
      this.logger.error('Error obteniendo status del certificado', error);
      return {
        existe: false,
      };
    }
  }

  /**
   * Obtener dashboard administrativo completo
   * Solo administradores
   */
  @Get('dashboard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener dashboard administrativo',
    description:
      'Retorna información completa del estado del sistema de certificados, incluyendo salud general y alertas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard administrativo',
    schema: {
      example: {
        certificados: {
          principal: {
            existe: true,
            estado: 'ACTIVO',
            diasParaVencer: 45,
            fechaVencimiento: '2025-12-31T00:00:00.000Z',
            alertas: ['✅ Certificado vigente'],
          },
        },
        salud: {
          rootRtiConfigurado: true,
          certificadoMaestroConfigurado: true,
        },
        alertas: [],
      },
    },
  })
  async obtenerDashboard(): Promise<AdminDashboardDto> {
    try {
      const statusCert = await this.obtenerStatus();
      const existe = await this.certificadoMaestroService.existeCertificadoMaestro();

      const alertas: string[] = [];

      if (!existe) {
        alertas.push('🔴 CRÍTICO: No hay certificado maestro configurado');
      } else if (statusCert.estado === 'EXPIRADO') {
        alertas.push('🔴 CRÍTICO: Certificado maestro expirado');
      } else if (statusCert.estado === 'PROXIMO_A_VENCER') {
        alertas.push(
          `⚠️ ADVERTENCIA: Certificado maestro vencerá en ${statusCert.diasParaVencer} días`,
        );
      }

      return {
        certificados: {
          principal: statusCert,
        },
        salud: {
          rootRtiConfigurado: existe,
          certificadoMaestroConfigurado: existe,
        },
        alertas,
      };
    } catch (error) {
      this.logger.error('Error obteniendo dashboard', error);
      return {
        certificados: {
          principal: { existe: false },
        },
        salud: {
          rootRtiConfigurado: false,
          certificadoMaestroConfigurado: false,
        },
        alertas: ['Error obteniendo información del dashboard'],
      };
    }
  }
}
