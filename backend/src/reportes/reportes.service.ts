import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { 
  QueryReporteCertificadosDto, 
  MetricasDto, 
  ReporteCertificados, 
  MetricasDashboard,
  FormatoReporte 
} from './dto/reportes.dto';

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}async getReporteCertificados(queryDto: QueryReporteCertificadosDto): Promise<ReporteCertificados> {
    // TODO: Implementar cuando se active TypeORM
    return {
      resumen: {
        total_descargas: 0,
        total_usuarios_activos: 0,
        descargas_pendientes: 0,
        descargas_facturadas: 0,
        descargas_canceladas: 0,
      },
      por_mayorista: [],
      por_distribuidor: [],
    };
  }  async getMetricasDashboard(metricasDto: MetricasDto): Promise<MetricasDashboard> {
    const { dias } = metricasDto;
    
    const [
      descargasHoy,
      descargasSemana, 
      descargasMes,
      usuariosActivos,
      topMayoristas,
      topDistribuidores,
      descargasPendientes
    ] = await Promise.all([
      this.getDescargasEnPeriodo(1),
      this.getDescargasEnPeriodo(7),
      this.getDescargasEnPeriodo(30),
      this.getUsuariosActivos(),
      this.getTopMayoristas(),
      this.getTopDistribuidores(),
      this.getDescargasPendientes(),
    ]);

    return {
      descargas_hoy: descargasHoy,
      descargas_semana: descargasSemana,
      descargas_mes: descargasMes,
      usuarios_activos: usuariosActivos.total,
      mayoristas_activos: usuariosActivos.mayoristas,
      distribuidores_activos: usuariosActivos.distribuidores,
      descargas_pendientes_total: descargasPendientes,
      top_mayoristas: topMayoristas,
      top_distribuidores: topDistribuidores,
    };
  }
  private async getDescargasEnPeriodo(dias: number): Promise<number> {
    // TODO: Implementar cuando se active TypeORM
    return 0;
  }  private async getUsuariosActivos() {
    const [total, mayoristas, distribuidores] = await Promise.all([
      this.userRepository.count({ where: { status: 1 } }),      
      this.userRepository.count({ where: { status: 1, rol: 2 } }), // MAYORISTA
      this.userRepository.count({ where: { status: 1, rol: 3 } }), // DISTRIBUIDOR
    ]);

    return { total, mayoristas, distribuidores };
  }private async getResumenDescargas(baseQuery: any) {
    return {
      total_descargas: 100,
      total_usuarios_activos: 45,
      descargas_pendientes: 25,
      descargas_facturadas: 70,
      descargas_canceladas: 5,
    };
  }
  private async getDescargasPorMayorista(baseQuery: any) {
    return [
      {
        id_mayorista: 1,
        mayorista_nombre: 'Mayorista Test',
        total_descargas: 50,
        descargas_pendientes: 10,
        distribuidores_activos: 5,
      }
    ];
  }
  private async getDescargasPorDistribuidor(baseQuery: any) {
    return [
      {
        distribuidor_id: 1,
        distribuidor_nombre: 'Distribuidor Test',
        mayorista_nombre: 'Mayorista Test',
        total_descargas: 25,
        descargas_pendientes: 5,
        limite_descargas: 10,
        porcentaje_limite_usado: 50,
      }
    ];
  }
  private async getTopMayoristas() {
    return [
      { id: 1, nombre: 'Mayorista A', total_descargas: 100 },
      { id: 2, nombre: 'Mayorista B', total_descargas: 80 },
    ];
  }
  private async getTopDistribuidores() {
    return [
      { id: 1, nombre: 'Distribuidor A', mayorista_nombre: 'Mayorista A', total_descargas: 50 },
      { id: 2, nombre: 'Distribuidor B', mayorista_nombre: 'Mayorista B', total_descargas: 40 },
    ];
  }

  private async getDescargasPendientes(): Promise<number> {
    return 25;
  }

  async exportToCsv(data: any[], headers: string[]): Promise<string> {
    const csvHeaders = headers.join(',') + '\n';
    const csvRows = data.map(row => 
      headers.map(header => `"${row[header] || ''}"`).join(',')
    ).join('\n');
    
    return csvHeaders + csvRows;
  }

  async exportToXls(data: any[]): Promise<Buffer> {
    // TODO: Implementar exportación XLS con librería como exceljs
    throw new Error('Exportación XLS no implementada aún');
  }
}