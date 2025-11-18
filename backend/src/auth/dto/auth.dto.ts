import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length, Matches, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: '20366299913',
    description: 'CUIT del usuario',
    minLength: 11,
    maxLength: 11
  })
  @IsString()
  @IsNotEmpty({ message: 'El CUIT es obligatorio' })
  @Length(11, 11, { message: 'El CUIT debe tener exactamente 11 caracteres' })
  @Matches(/^\d{11}$/, { message: 'El CUIT debe contener solo números' })
  cuit: string;

  @ApiProperty({
    example: 'mi_contraseña_segura',
    description: 'Contraseña del usuario',
    minLength: 6
  })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MinLength(6)
  password: string;
}

export class ChangePasswordDto {
 
  @ApiProperty({
    example: 'nueva_contraseña_segura',
    description: 'Nueva contraseña',
    minLength: 6
  })
  @IsString()
  @IsNotEmpty({ message: 'La nueva contraseña es obligatoria' })
  @Length(6, 100, { message: 'La contraseña debe tener entre 6 y 100 caracteres' })
  newPassword: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    example: 'contraseña_temporal_123',
    description: 'Nueva contraseña para el usuario',
    minLength: 6
  })
  @IsString()
  @IsNotEmpty({ message: 'La nueva contraseña es obligatoria' })
  @Length(6, 100, { message: 'La contraseña debe tener entre 6 y 100 caracteres' })
  newPassword: string;
}

export interface JwtPayload {
  id: number;
  cuit: string;
  nombre: string;
  rol: number;
  mustChangePassword: boolean;
  id_mayorista?: number;
}

export class LoginResponse {
  @ApiProperty({ 
    description: 'Token JWT de acceso',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  access_token: string;

  @ApiProperty({ 
    description: 'Información del usuario logueado',
    type: Object,
    example: {
      id: 1,
      cuit: '20366299913',
      nombre: 'Usuario Admin',
      email: 'admin@sersa.com',
      rol: 1,
      must_change_password: false,
      last_login: '2024-10-28T10:30:00Z',
      limite_descargas: 5
    }
  })
  user: {
    id: number;
    cuit: string;
    nombre: string;
    email: string;
    rol: number;
    must_change_password: boolean;
    last_login: Date | null;
    id_mayorista?: number;
    limite_descargas?: number;
  };
}