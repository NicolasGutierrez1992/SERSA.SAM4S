import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength } from 'class-validator';


export class LoginDto {
  @ApiProperty({
    example: '20366299913',
    description: 'CUIT del usuario (11 dígitos numéricos)',
    minLength: 11,
    maxLength: 11,
  })
  @IsString()
  @IsNotEmpty({ message: 'El CUIT es obligatorio' })
  @Length(11, 11, { message: 'El CUIT debe tener exactamente 11 caracteres' })
  @Matches(/^\d{11}$/, { message: 'El CUIT debe contener solo números' })
  cuit: string;

  @ApiProperty({
    example: 'MiPassword1!',
    description: 'Contraseña del usuario',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MinLength(6)
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: 'Contraseña actual del usuario' })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña actual es obligatoria' })
  currentPassword: string;

  @ApiProperty({
    example: 'nuevacontrasena',
    description: 'Nueva contraseña',
  })
  @IsString()
  @IsNotEmpty({ message: 'La nueva contraseña es obligatoria' })
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
  // Token used internally by the controller to set the httpOnly cookie; not sent in the response body
  access_token: string;

  @ApiProperty({
    description: 'Información del usuario logueado (el token viaja en cookie httpOnly)',
    type: Object,
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
