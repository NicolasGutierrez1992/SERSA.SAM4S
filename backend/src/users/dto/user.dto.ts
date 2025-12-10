import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsEmail, IsNotEmpty, IsOptional, IsEnum, IsNumber, Length, Matches, IsPositive, Min, Max, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum UserRole {
  ADMINISTRADOR = 1,
  ADMIN = 1, // Alias
  MAYORISTA = 2,
  DISTRIBUIDOR = 3,
  FACTURACION = 4,
}

export enum UserStatus {
  INACTIVO = 0,
  ACTIVO = 1,
}

export class CreateUserDto {
  @ApiProperty({
    example: 'Juan Pérez',
    description: 'Nombre completo del usuario',
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @Length(2, 100, { message: 'El nombre debe tener entre 2 y 100 caracteres' })
  nombre: string;

  @ApiProperty({
    example: 'juan@example.com',
    description: 'Email del usuario',
  })
  @IsEmail({}, { message: 'Debe ser un email válido' })
  @IsNotEmpty({ message: 'El email es obligatorio' })
  email: string;

  @ApiProperty({
    example: '20123456789',
    description: 'CUIT del usuario (11 dígitos numéricos)',
  })
  @IsString()
  @IsNotEmpty({ message: 'El CUIT es obligatorio' })
  @Length(11, 11, { message: 'El CUIT debe tener exactamente 11 caracteres' })
  @Matches(/^\d{11}$/, { message: 'El CUIT debe contener solo números' })
  cuit: string;

  @ApiProperty({
    example: 'TempPass123!',
    description: 'Contraseña temporal inicial',
  })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña temporal es obligatoria' })
  @Length(6, 100, { message: 'La contraseña debe tener entre 6 y 100 caracteres' })
  password: string;

  @ApiProperty({
    example: 2,
    enum: UserRole,
    description: 'Rol del usuario (1=Admin, 2=Mayorista, 3=Distribuidor, 4=Facturación)',
  })
  @IsEnum(UserRole, { message: 'El rol debe ser válido' })
  @Type(() => Number)
  rol: UserRole;

  @ApiPropertyOptional({
    example: 1,
    enum: UserStatus,
    description: 'Estado del usuario (0=Inactivo, 1=Activo)',
  })
  @IsOptional()
  @IsEnum(UserStatus, { message: 'El estado debe ser válido' })
  @Type(() => Number)
  status?: UserStatus;

  @ApiPropertyOptional({
    example: 1,
    description: 'ID del mayorista (obligatorio para distribuidores)',
  })
  @IsOptional()
  @IsNumber({}, { message: 'El ID del mayorista debe ser un número' })
  @Type(() => Number)
  id_mayorista?: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Límite de descargas pendientes (por defecto 5)',
  })
  @IsOptional()
  @IsNumber({}, { message: 'El límite debe ser un número' })
  @Min(0, { message: 'El límite mínimo es 0 ' })
  @Max(1000, { message: 'El límite máximo es 1000' })
  @Type(() => Number)
  limiteDescargas?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'ID del usuario que creó este registro',
  })
  @IsOptional()
  @IsNumber({}, { message: 'El ID del usuario debe ser un número' })
  @Type(() => Number)
  created_by?: number;

  @ApiPropertyOptional({
    example: "1112345678",
    description: 'Numero de celular para enviar confirmacion via Whatsapp',
  })
  @IsOptional()
  @IsString({ message: 'Debe ser un número de celular válido' })
  @Length(10, 15, { message: 'El número de celular debe tener entre 10 y 15 caracteres' })
  celular?: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({
    example: 'Juan Carlos Pérez',
    description: 'Nombre completo del usuario',
  })
  @IsOptional()
  @IsString()
  @Length(2, 100, { message: 'El nombre debe tener entre 2 y 100 caracteres' })
  nombre?: string;

  @ApiPropertyOptional({
    example: 'juan.carlos@example.com',
    description: 'Email del usuario',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Debe ser un email válido' })
  email?: string;

  @ApiPropertyOptional({
    example: '20123456789',
    description: 'CUIT del usuario (11 dígitos numéricos)',
  })
  @IsOptional()
  @IsString()
  @Length(11, 11, { message: 'El CUIT debe tener exactamente 11 caracteres' })
  @Matches(/^\d{11}$/, { message: 'El CUIT debe contener solo números' })
  cuit?: string;

  @ApiPropertyOptional({
    example: 'TempPass123!',
    description: 'Contraseña temporal inicial',
  })
  @IsOptional()
  @IsString()
  @Length(6, 100, { message: 'La contraseña debe tener entre 6 y 100 caracteres' })
  password?: string;

  @ApiPropertyOptional({
    example: 1,
    enum: UserRole,
    description: 'Rol del usuario (1=Admin, 2=Mayorista, 3=Distribuidor, 4=Facturación)',
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'El rol debe ser válido' })
  @Type(() => Number)
  rol?: UserRole;

  @ApiPropertyOptional({
    example: 1,
    enum: UserStatus,
    description: 'Estado del usuario (0=Inactivo, 1=Activo)',
  })
  @IsOptional()
  @IsEnum(UserStatus, { message: 'El estado debe ser válido' })
  @Type(() => Number)
  status?: UserStatus;

  @ApiPropertyOptional({
    example: 1,
    description: 'ID del mayorista (solo para distribuidores)',
  })
  @IsOptional()
  @IsNumber({}, { message: 'El ID del mayorista debe ser un número' })
  @Type(() => Number)
  id_mayorista?: number;

  @ApiPropertyOptional({
    example: 15,
    description: 'Límite de descargas pendientes',
  })
  @IsOptional()
  @IsNumber({}, { message: 'El límite debe ser un número' })
  @Min(0, { message: 'El límite mínimo es 0' })
  @Max(1000, { message: 'El límite máximo es 1000' })
  @Type(() => Number)
  limiteDescargas?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Indica si el usuario debe cambiar su contraseña',
  })
  @IsOptional()
  @IsBoolean({ message: 'Debe ser un valor booleano' })
  must_change_password?: boolean;
   
  @IsOptional()
  @IsString({ message: 'Debe ser un número de celular válido' })
  @Length(10, 15, { message: 'El número de celular debe tener entre 10 y 15 caracteres' })
  celular?: string;
}

export class QueryUsersDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Página (por defecto 1)',
  })
  @IsOptional()
  @IsNumber({}, { message: 'La página debe ser un número' })
  @IsPositive({ message: 'La página debe ser mayor a 0' })
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 10,
    description: 'Elementos por página (por defecto 10)',
  })
  @IsOptional()
  @IsNumber({}, { message: 'El límite debe ser un número' })
  @Min(0, { message: 'El límite mínimo es 0' })
  @Max(1000, { message: 'El límite máximo es 1000' })
  @Type(() => Number)
  limit?: number = 100;

  @ApiPropertyOptional({
    example: 2,
    enum: UserRole,
    description: 'Filtrar por rol',
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'El rol debe ser válido' })
  @Type(() => Number)
  rol?: UserRole;

  @ApiPropertyOptional({
    example: 1,
    enum: UserStatus,
    description: 'Filtrar por estado',
  })
  @IsOptional()
  @IsEnum(UserStatus, { message: 'El estado debe ser válido' })
  @Type(() => Number)
  status?: UserStatus;

  @ApiPropertyOptional({
    example: 1,
    description: 'Filtrar por mayorista',
  })
  @IsOptional()
  @IsNumber({}, { message: 'El ID del mayorista debe ser un número' })
  @Type(() => Number)
  id_mayorista?: number;
}

export class ChangePasswordDto {
    @ApiProperty({
    example: 'NewPass123!',
    description: 'Nueva contraseña del usuario',
  })
  @IsString()
  @IsNotEmpty({ message: 'La nueva contraseña es obligatoria' })
  @Length(6, 100, { message: 'La contraseña debe tener entre 6 y 100 caracteres' })
  newPassword: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    example: 'NewPass123!',
    description: 'Nueva contraseña del usuario',
  })
  @IsString()
  @IsNotEmpty({ message: 'La nueva contraseña es obligatoria' })
  @Length(6, 100, { message: 'La contraseña debe tener entre 6 y 100 caracteres' })
  newPassword: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Indica si el usuario debe cambiar su contraseña',
  })
  @IsOptional()
  @IsBoolean({ message: 'Debe ser un valor booleano' })
  mustChange?: boolean;

   @ApiPropertyOptional({
    example: "1112345678",
    description: 'Numero de celular para enviar confirmacion via Whatsapp',
  })
  @IsOptional()
  @IsString({ message: 'Debe ser un número de celular válido' })
  @Length(10, 15, { message: 'El número de celular debe tener entre 10 y 15 caracteres' })
  celular?: string;
}