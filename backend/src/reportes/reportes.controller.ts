import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportesService } from './reportes.service';
import { QueryReporteCertificadosDto, MetricasDto } from './dto/reportes.dto';
import { RequireAdmin, RequireAdminOrFacturacion } from '../auth/decorators/roles.decorator';

@ApiTags('reportes')
@Controller('reportes')
@ApiBearerAuth()
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('certificados')
  @RequireAdminOrFacturacion()
  @ApiOperation({ summary: 'Obtener reporte de certificados con filtros' })
  @ApiResponse({ status: 200, description: 'Reporte generado exitosamente' })
  async getReporteCertificados(@Query() queryDto: QueryReporteCertificadosDto) {
    return await this.reportesService.getReporteCertificados(queryDto);
  }

  @Get('certificados/export')
  @RequireAdminOrFacturacion()
  @ApiOperation({ summary: 'Exportar reporte de certificados' })
  async exportReporteCertificados(
    @Query() queryDto: QueryReporteCertificadosDto,
    @Res() res: Response
  ) {
    const reporte = await this.reportesService.getReporteCertificados(queryDto);
    
    if (queryDto.formato === 'CSV') {
      const csv = await this.reportesService.exportToCsv(
        reporte.por_distribuidor,
        ['distribuidor_nombre', 'mayorista_nombre', 'total_descargas', 'descargas_pendientes']
      );
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="reporte_certificados.csv"');
      res.send(csv);
    } else {
      res.json(reporte);
    }
  }

  @Get('dashboard')
  @RequireAdmin()
  @ApiOperation({ summary: 'Obtener métricas para dashboard' })
  @ApiResponse({ status: 200, description: 'Métricas obtenidas exitosamente' })
  async getDashboard(@Query() metricasDto: MetricasDto) {
    return await this.reportesService.getMetricasDashboard(metricasDto);
  }
}