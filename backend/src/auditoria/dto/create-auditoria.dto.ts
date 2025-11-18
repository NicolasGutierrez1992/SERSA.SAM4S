import { IsString, IsNumber, IsOptional, IsObject } from 'class-validator';

export class CreateAuditoriaDto {
  @IsOptional()
  @IsNumber()
  actor_id?: number;

  @IsString()
  accion: string;

  @IsString()
  objetivo_tipo: string;

  @IsOptional()
  @IsString()
  objetivo_id?: string;

  @IsOptional()
  @IsString()
  ip?: string;

  @IsOptional()
  @IsObject()
  antes?: any;

  @IsOptional()
  @IsObject()
  despues?: any;
}