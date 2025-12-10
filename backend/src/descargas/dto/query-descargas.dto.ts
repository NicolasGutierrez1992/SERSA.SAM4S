import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsDateString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryDescargasDto {
  @ApiPropertyOptional({ 
    description: 'Página',
    example: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ 
    description: 'Límite de resultados',
    example: 50
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ 
    description: 'Fecha desde (YYYY-MM-DD)',
    example: '2024-01-01'
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe tener formato válido (YYYY-MM-DD)' })
  fechaDesde?: string;

  @ApiPropertyOptional({ 
    description: 'Fecha hasta (YYYY-MM-DD)',
    example: '2024-12-31'
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe tener formato válido (YYYY-MM-DD)' })
  fechaHasta?: string;
  
  @ApiPropertyOptional({ 
    description: 'Mes de descarga (1-12)',
    example: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(12)
  mes?: number;

  @ApiPropertyOptional({ 
    description: 'Año de descarga',
    example: 2025
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(2025)
  @Max(2100)
  anio?: number;

  @ApiPropertyOptional({ 
    description: 'ID del controlador',
    example: 'CTRL001234'
  })
  @IsOptional()
  @IsString()
  controladorId?: string;

  @ApiPropertyOptional({ 
    description: 'CUIT del usuario',
    example: '20366299913'
  })
  @IsOptional()
  @IsString()
  cuit?: string;

  @ApiPropertyOptional({ 
    description: 'ID del mayorista',
    example: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  idMayorista?: number;
  
  @ApiPropertyOptional({ 
    description: 'Estado de facturación mayorista',
    example: 'Pendiente de Facturar'
  })
  @IsOptional()
  @IsString()
  estadoMayorista?: string;

  @ApiPropertyOptional({
    example: 'SH',
    description: 'Marca del controlador'
  })
  @IsOptional()
  @IsString()
  marca?: string;

  @ApiPropertyOptional({
    example: 'Pendiente de Facturar',
    description: 'Estado distribuidor'
  })
  @IsOptional()
  @IsString()
  estadoDistribuidor?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Filtrar por usuario',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  usuarioId?: number;
}
