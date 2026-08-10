import { IsString, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryAuditoriaDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  actor_id?: number;

  @IsOptional()
  @IsString()
  accion?: string;

  @IsOptional()
  @IsString()
  objetivo_tipo?: string;

  @IsOptional()
  @IsString()
  objetivo_id?: string;

  @IsOptional()
  @IsString()
  fecha_desde?: string;

  @IsOptional()
  @IsString()
  fecha_hasta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}