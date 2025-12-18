import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { AppSettingsService } from '../services/app-settings.service';
import { JwtAuthGuard } from '../../auth/guards/auth.guards';
import { RequireAdmin } from '../../auth/decorators/roles.decorator';

interface UpdateSettingDto {
  value: string;
}

interface SettingResponseDto {
  id: string;
  value: string;
  description?: string;
  data_type?: string;
  updated_at: Date;
}

interface AllSettingsResponseDto extends SettingResponseDto {}

@ApiTags('App Settings')
@Controller('app-settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@RequireAdmin()
export class AppSettingsController {
  constructor(private readonly appSettingsService: AppSettingsService) {}
  /**
   * Obtener todas las configuraciones
   * Solo administradores
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener todas las configuraciones',
    description:
      'Retorna todas las configuraciones de la aplicación. Solo administradores pueden acceder.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de todas las configuraciones',
    schema: {
      example: [
        {
          id: 'NOTIFICATION_LIMIT',
          value: '100',
          description: 'Límite de descargas pendientes',
          data_type: 'number'
        }
      ],
    },
  })  async obtenerTodas(): Promise<AllSettingsResponseDto[]> {
    return await this.appSettingsService.obtenerTodosLosSettingsCompleto();
  }
  /**
   * Obtener información completa de una configuración
   * Solo administradores
   */
  @Get(':key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener configuración por key',
    description:
      'Retorna la información completa de una configuración específica. Solo administradores pueden acceder.',
  })
  @ApiResponse({
    status: 200,
    description: 'Información de la configuración',
  })
  @ApiResponse({
    status: 404,
    description: 'Configuración no encontrada',
  })
  async obtenerPorKey(@Param('key') key: string): Promise<SettingResponseDto> {
    return await this.appSettingsService.obtenerInfoSetting(key);
  }

  /**
   * Actualizar una configuración
   * Solo administradores
   */
  @Put(':key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualizar configuración',
    description:
      'Actualiza el valor de una configuración específica. Solo administradores pueden realizar esta acción.',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuración actualizada exitosamente',
    schema: {
      example: {
        mensaje: 'Configuración NOTIFICATION_LIMIT actualizada a 150',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Configuración no encontrada',
  })
  async actualizar(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
  ): Promise<{ mensaje: string }> {
    await this.appSettingsService.actualizarSetting(key, dto.value);
    return {
      mensaje: `Configuración ${key} actualizada a ${dto.value}`,
    };
  }

  /**
   * Obtener información de caché
   * Solo administradores
   */
  @Get('debug/cache-stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener estadísticas del caché',
    description: 'Retorna información del estado actual del caché de configuraciones.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas del caché',
    schema: {
      example: {
        totalSettings: 3,
        lastUpdate: '2025-12-17T10:30:45.123Z',
        needsRefresh: false,
      },
    },
  })
  getCacheStats(): any {
    return this.appSettingsService.getCacheStats();
  }

  /**
   * Forzar actualización del caché
   * Solo administradores
   */
  @Put('debug/refresh-cache')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Forzar actualización del caché',
    description:
      'Recarga todas las configuraciones desde BD. Útil para sincronizar en caso de cambios externos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Caché actualizado',
    schema: {
      example: {
        mensaje: 'Caché actualizado exitosamente',
      },
    },
  })
  async forceRefreshCache(): Promise<{ mensaje: string }> {
    await this.appSettingsService.forceRefreshCache();
    return { mensaje: 'Caché actualizado exitosamente' };
  }
}
