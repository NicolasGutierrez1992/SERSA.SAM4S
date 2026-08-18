import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryResumenFacturasDto {
  @ApiPropertyOptional({ description: 'ID del mayorista', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  idMayorista?: number;

  @ApiPropertyOptional({
    description: 'Fecha desde (YYYY-MM-DD)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha debe tener formato válido (YYYY-MM-DD)' },
  )
  fechaDesde?: string;

  @ApiPropertyOptional({
    description: 'Fecha hasta (YYYY-MM-DD)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha debe tener formato válido (YYYY-MM-DD)' },
  )
  fechaHasta?: string;

  @ApiPropertyOptional({
    description: 'Estado de facturación mayorista',
    example: 'Facturado',
  })
  @IsOptional()
  @IsString()
  estadoMayorista?: string;

  @ApiPropertyOptional({
    description: 'CUIT del usuario',
    example: '20366299913',
  })
  @IsOptional()
  @IsString()
  cuit?: string;

  @ApiPropertyOptional({
    description: 'Nombre del usuario (búsqueda parcial)',
    example: 'Juan',
  })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({
    enum: ['MAYORISTA', 'DISTRIBUIDOR'],
    description:
      'MAYORISTA (default): agrupa todas las descargas por Mayorista y su factura. DISTRIBUIDOR: agrupa solo las descargas hechas por un Distribuidor, por su propia factura.',
  })
  @IsOptional()
  @IsString()
  modo?: 'MAYORISTA' | 'DISTRIBUIDOR';
}
