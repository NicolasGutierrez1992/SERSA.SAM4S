import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsUUID, IsNumber, IsDateString, Min, Max, Matches, isString } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { EstadoDescarga } from '../../shared/types';

// Re-export EstadoDescarga for easier imports
export { EstadoDescarga };

export class CreateDescargaDto {
  @ApiPropertyOptional({ 
    description: 'ID del controlador fiscal (opcional)',
    example: 'CTRL001234'
  })
  @IsOptional()
  @IsString()
  controladorId?: string;

  @ApiProperty({ 
    description: 'Marca del controlador (siempre debe ser "SH")',
    example: 'SH',
    enum: ['SH']
  })
  @IsString()
  @IsEnum(['SH'], { message: 'La marca debe ser "SH"' })
  marca: string;

  @ApiProperty({ 
    description: 'Modelo del controlador (IA o RA)',
    example: 'IA',
    enum: ['IA', 'RA']
  })
  @IsString()
  @IsEnum(['IA', 'RA'], { message: 'El modelo debe ser "IA" o "RA"' })
  modelo: string;

  @ApiProperty({ 
    description: 'Número de serie del controlador (hasta 10 dígitos numéricos, se completará con ceros a la izquierda)',
    example: '12345678',
    pattern: '^\\d{1,10}$'
  })
  @IsString()
  @Matches(/^\d{1,10}$/, { message: 'El número de serie debe contener entre 1 y 10 dígitos numéricos' })
  numeroSerie: string;
}

export class UpdateEstadoDescargaDto {
  @ApiPropertyOptional({ 
    description: 'Nuevo estado mayorista',
    enum: EstadoDescarga
  })
  @IsOptional()
  @IsEnum(EstadoDescarga)
  estadoMayorista?: EstadoDescarga;

  @ApiPropertyOptional({ 
    description: 'Nuevo estado distribuidor (solo admin)',
    enum: EstadoDescarga
  })
  @IsOptional()
  @IsEnum(EstadoDescarga)
  estadoDistribuidor?: EstadoDescarga;
}

export class QueryDescargasDto {
  @ApiPropertyOptional({ 
    description: 'Página',
    example: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ 
    description: 'Límite de resultados',
    example: 50
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
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
    description: 'Mes de descarga',
    example: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El mes debe ser un número' })
  @Min(1)
  @Max(12)
  mes?: number;

  @ApiPropertyOptional({ 
    description: 'Año de descarga',
    example: 2025
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El año debe ser un número' })
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
}

export class DownloadResponseDto {
  @ApiProperty({ 
    description: 'ID único de la descarga',
    example: 'uuid-123-456-789'
  })
  downloadId: string;

  @ApiProperty({ 
    description: 'Nombre del certificado generado',
    example: 'Certificado_CTRL001234_20241028.pem'
  })
  filename: string;

  @ApiProperty({ 
    description: 'Tamaño del archivo en bytes',
    example: 2048
  })
  size: number;

  @ApiProperty({ 
    description: 'Checksum MD5 del archivo',
    example: 'a1b2c3d4e5f6...'
  })
  checksum: string;
}