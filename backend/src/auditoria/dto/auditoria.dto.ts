import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsDateString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum AuditoriaAccion {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  CHANGE_PASSWORD = 'CHANGE_PASSWORD',
  RESET_PASSWORD = 'RESET_PASSWORD',
  DOWNLOAD = 'DOWNLOAD',
  EXPORT = 'EXPORT',
}

export enum AuditoriaEntidad {
  USER = 'User',
  CERTIFICADO = 'Certificado',
  DESCARGA = 'Descarga', 
  NOTIFICACION = 'Notificacion',
}

export class CreateAuditoriaDto {
  @ApiProperty({ description: 'ID del usuario que realiza la acción' })
  @IsNumber()
  @Type(() => Number)
  user_id: number;

  @ApiProperty({ description: 'Acción realizada', enum: AuditoriaAccion })
  @IsEnum(AuditoriaAccion)
  accion: AuditoriaAccion;

  @ApiProperty({ description: 'Entidad afectada', enum: AuditoriaEntidad })
  @IsEnum(AuditoriaEntidad)
  entidad: AuditoriaEntidad;

  @ApiPropertyOptional({ description: 'ID de la entidad afectada' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  entidad_id?: number;

  @ApiPropertyOptional({ description: 'Valores anteriores' })
  @IsOptional()
  valores_anteriores?: any;

  @ApiPropertyOptional({ description: 'Valores nuevos' })
  @IsOptional()
  valores_nuevos?: any;
  @ApiProperty({ description: 'Dirección IP' })
  @IsString()
  ip: string;

  @ApiPropertyOptional({ description: 'Metadata adicional' })
  @IsOptional()
  metadata?: any;
}

export class QueryAuditoriaDto {
  @ApiPropertyOptional({ description: 'ID del usuario' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  user_id?: number;

  @ApiPropertyOptional({ description: 'Acción', enum: AuditoriaAccion })
  @IsOptional()
  @IsEnum(AuditoriaAccion)
  accion?: AuditoriaAccion;

  @ApiPropertyOptional({ description: 'Entidad', enum: AuditoriaEntidad })
  @IsOptional()
  @IsEnum(AuditoriaEntidad)
  entidad?: AuditoriaEntidad;

  @ApiPropertyOptional({ description: 'ID de la entidad' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  entidad_id?: number;

  @ApiPropertyOptional({ description: 'Fecha desde (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @ApiPropertyOptional({ description: 'Fecha hasta (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;

  @ApiPropertyOptional({ description: 'Página', default: 1 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Elementos por página', default: 20 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number = 20;
}