import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, Matches, Length } from 'class-validator';

export class ChangePasswordDto {

  @ApiProperty({ 
    description: 'Nueva contraseña',
    example: 'NuevaPassword123!'
  })
  @IsString()
  @IsNotEmpty()
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}