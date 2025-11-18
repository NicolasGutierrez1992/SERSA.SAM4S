import { IsString, IsNumber, IsOptional } from 'class-validator';

export class QueryAuditoriaDto {
  @IsOptional()
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
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;
}