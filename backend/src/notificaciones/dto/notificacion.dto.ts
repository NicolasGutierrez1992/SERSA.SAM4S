import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsObject, IsEnum, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export enum TipoNotificacion {
  LIMITE_ALCANZADO = 'LIMITE_ALCANZADO',
  LIMITE_80_PORCIENTO = 'LIMITE_80_PORCIENTO',
  DESCARGA_COMPLETADA = 'DESCARGA_COMPLETADA',
  ERROR_DESCARGA = 'ERROR_DESCARGA',
}

export enum EstadoEnvio {
  PENDIENTE = 'Pendiente',
  ENVIADO = 'Enviado',
  ERROR = 'Error',
}

export class CreateNotificacionDto {
  @ApiProperty({ description: 'Tipo de notificación' })
  @IsString()
  tipo: string;

  @ApiPropertyOptional({ description: 'ID del destinatario' })
  @IsOptional()
  @IsNumber()
  destinatario_id?: number;

  @ApiPropertyOptional({ description: 'Estado del envío' })
  @IsOptional()
  @IsString()
  estado_envio?: string;

  @ApiPropertyOptional({ description: 'Datos adicionales' })
  @IsOptional()
  @IsObject()
  payload?: any;
}

export class QueryNotificacionesDto {
  @ApiPropertyOptional({ description: 'ID del usuario' })
  @IsOptional()
  @IsNumber()
  user_id?: number;

  @ApiPropertyOptional({ description: 'Tipo de notificación' })
  @IsOptional()
  @IsString()
  tipo?: string;

  @ApiPropertyOptional({ description: 'Estado del envío' })
  @IsOptional()
  @IsString()
  estado_envio?: string;

  @ApiPropertyOptional({ description: 'Solo no leídas' })
  @IsOptional()
  @IsBoolean()
  no_leidas?: boolean;

  @ApiPropertyOptional({ description: 'Página', default: 1 })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: 'Elementos por página', default: 10 })
  @IsOptional()
  @IsNumber()
  limit?: number;
}

export class UpdateNotificacionDto {
  @ApiPropertyOptional({ description: 'Tipo de notificación' })
  @IsOptional()
  @IsString()
  tipo?: string;

  @ApiPropertyOptional({ description: 'ID del destinatario' })
  @IsOptional()
  @IsNumber()
  destinatario_id?: number;

  @ApiPropertyOptional({ description: 'Estado del envío' })
  @IsOptional()
  @IsString()
  estado_envio?: string;

  @ApiPropertyOptional({ description: 'Datos adicionales' })
  @IsOptional()
  @IsObject()
  payload?: any;
}