import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'CUIT del usuario', example: '20123456789' })
  @IsString()
  @IsNotEmpty()
  @Length(11, 11, { message: 'El CUIT debe tener 11 dígitos' })
  @Matches(/^\d{11}$/, { message: 'El CUIT debe contener solo números' })
  cuit: string;

  @ApiProperty({ description: 'Contraseña', example: 'MiPassword123!' })
  @IsString()
  @IsNotEmpty()
  password: string;
}