import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
  Post,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { AuditoriaService } from './auditoria.service';
import { QueryAuditoriaDto } from './dto/query-auditoria.dto';
import { RequireAdmin, RequireAdminOrFacturacion } from '../auth/decorators/roles.decorator';


@ApiTags('auditoria')
@Controller('auditoria')
@ApiBearerAuth()
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}  @Get()
  @RequireAdminOrFacturacion()
  @ApiOperation({ summary: 'Obtener logs de auditoría con filtros' })
  @ApiResponse({ status: 200, description: 'Logs de auditoría obtenidos exitosamente' })
  @ApiQuery({ name: 'user_id', required: false, description: 'Filtrar por usuario' })
  @ApiQuery({ name: 'accion', required: false, description: 'Filtrar por acción' })
  @ApiQuery({ name: 'entidad', required: false, description: 'Filtrar por entidad' })
  @ApiQuery({ name: 'entidad_id', required: false, description: 'Filtrar por ID de entidad' })
  @ApiQuery({ name: 'fecha_desde', required: false, description: 'Fecha desde (YYYY-MM-DD)' })
  @ApiQuery({ name: 'fecha_hasta', required: false, description: 'Fecha hasta (YYYY-MM-DD)' })
  @ApiQuery({ name: 'page', required: false, description: 'Página' })
  @ApiQuery({ name: 'limit', required: false, description: 'Elementos por página' })
  async findAll(@Query() queryDto: QueryAuditoriaDto) {
    return await this.auditoriaService.findAll(queryDto);
  }  @Get('statistics')
  @RequireAdminOrFacturacion()
  @ApiOperation({ summary: 'Obtener estadísticas de auditoría' })
  @ApiResponse({ status: 200, description: 'Estadísticas obtenidas exitosamente' })
  @ApiQuery({ name: 'fecha_desde', required: false, description: 'Fecha desde (YYYY-MM-DD)' })
  @ApiQuery({ name: 'fecha_hasta', required: false, description: 'Fecha hasta (YYYY-MM-DD)' })
  async getStatistics(
    @Query('fecha_desde') fechaDesde?: string,
    @Query('fecha_hasta') fechaHasta?: string,
  ) {
    return await this.auditoriaService.getStatistics(fechaDesde, fechaHasta);
  }  @Get('export/csv')
  @RequireAdmin()
  @ApiOperation({ summary: 'Exportar auditoría a CSV' })
  @ApiResponse({ status: 200, description: 'Archivo CSV generado' })
  async exportCSV(
    @Query() queryDto: QueryAuditoriaDto,
    @Res() res: Response
  ): Promise<void> {
    const csv = await this.auditoriaService.exportToCSV(queryDto);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="auditoria.csv"');
    res.send(csv);
  }
  @Post('cleanup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Limpiar registros de auditoría antiguos (solo admin)' })
  @ApiResponse({ status: 200, description: 'Limpieza realizada exitosamente' })
  @ApiQuery({ name: 'dias_retencion', required: false, description: 'Días de retención (por defecto 365)' })
  async cleanup(@Query('dias_retencion') diasRetencion: number = 365) {
    const eliminados = await this.auditoriaService.cleanup(diasRetencion);
    return { 
      message: 'Limpieza de auditoría completada',
      registros_eliminados: eliminados
    };
  }
}