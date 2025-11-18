import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, IsEnum, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export enum TipoReporte {
  DESCARGAS = 'DESCARGAS',
  USUARIOS = 'USUARIOS',
  LIMITES = 'LIMITES',
  AUDITORIA = 'AUDITORIA',
}

export enum FormatoReporte {
  JSON = 'JSON',
  CSV = 'CSV',
  XLS = 'XLS',
}

export class QueryReporteCertificadosDto {
  @ApiPropertyOptional({ description: 'Fecha desde (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @ApiPropertyOptional({ description: 'Fecha hasta (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;

  @ApiPropertyOptional({ description: 'ID del mayorista' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  id_mayorista?: number;

  @ApiPropertyOptional({ description: 'ID del distribuidor' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  distribuidor_id?: number;

  @ApiPropertyOptional({ description: 'Estado mayorista' })
  @IsOptional()
  @IsString()
  estado_mayorista?: string;

  @ApiPropertyOptional({ description: 'Estado distribuidor' })
  @IsOptional()
  @IsString()
  estado_distribuidor?: string;

  @ApiPropertyOptional({ description: 'Formato del reporte', enum: FormatoReporte, default: 'JSON' })
  @IsOptional()
  @IsEnum(FormatoReporte)
  formato?: FormatoReporte = FormatoReporte.JSON;
}

export class MetricasDto {
  @ApiPropertyOptional({ description: 'Número de días hacia atrás para métricas', default: 30 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  dias?: number = 30;

  @ApiPropertyOptional({ description: 'Incluir desglose por usuario' })
  @IsOptional()
  incluir_usuarios?: boolean = false;
}

export interface ReporteCertificados {
  resumen: {
    total_descargas: number;
    total_usuarios_activos: number;
    descargas_pendientes: number;
    descargas_facturadas: number;
    descargas_canceladas: number;
  };
  por_mayorista: {
    id_mayorista: number;
    mayorista_nombre: string;
    total_descargas: number;
    descargas_pendientes: number;
    distribuidores_activos: number;
  }[];
  por_distribuidor: {
    distribuidor_id: number;
    distribuidor_nombre: string;
    mayorista_nombre: string;
    total_descargas: number;
    descargas_pendientes: number;
    limite_descargas: number;
    porcentaje_limite_usado: number;
  }[];
  detalle_descargas?: any[];
}

export interface MetricasDashboard {
  descargas_hoy: number;
  descargas_semana: number;
  descargas_mes: number;
  usuarios_activos: number;
  mayoristas_activos: number;
  distribuidores_activos: number;
  descargas_pendientes_total: number;
  top_mayoristas: {
    id: number;
    nombre: string;
    total_descargas: number;
  }[];
  top_distribuidores: {
    id: number;
    nombre: string;
    mayorista_nombre: string;
    total_descargas: number;
  }[];
  descargas_por_dia?: {
    fecha: string;
    total: number;
  }[];
  alertas_limite?: {
    user_id: number;
    nombre: string;
    tipo: string; // mayorista o distribuidor
    limite: number;
    usado: number;
    porcentaje: number;
  }[];
}