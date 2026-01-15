import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, ChangePasswordDto, ResetPasswordDto, LoginResponse } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/auth.guards';
import { CurrentUser } from './decorators/current-user.decorator';
import { RequireAdmin, RequireAdminOrTecnico } from './decorators/roles.decorator';

@ApiTags('autenticacion')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 200, description: 'Login exitoso', type: Object })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(@Body() loginDto: LoginDto, @Req() req: Request): Promise<LoginResponse> {
    const ip = req.ip || req.connection.remoteAddress;
    try {
      // Logs de depuración (sin datos sensibles)
      console.log('[AuthController][login] Request login recibida', {
        cuit: loginDto.cuit,
        passwordLength: typeof loginDto.password === 'string' ? loginDto.password.length : 'n/a',
        ip,
        contentType: req.headers['content-type']
      });
    } catch (err) {
      console.warn('[AuthController][login] Error al loguear request:', err);
    }

    return await this.authService.login(loginDto, ip);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambiar contraseña propia' })
  @ApiResponse({ status: 204, description: 'Contraseña cambiada exitosamente' })
  @ApiResponse({ status: 400, description: 'Contraseña actual incorrecta' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async changePassword(
    @CurrentUser('id') userId: number,
    @Body() changePasswordDto: ChangePasswordDto
  ): Promise<void> {
    await this.authService.changePassword(userId, changePasswordDto);
  }
  // utilizada para el seteo de contraseña en primer login
  @Post('reset-password/:userId')
  @RequireAdminOrTecnico()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resetear contraseña de usuario (solo admin o técnico)' })
  @ApiResponse({ status: 204, description: 'Contraseña reseteada exitosamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async resetPassword(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() resetPasswordDto: ResetPasswordDto
  ): Promise<void> {
    await this.authService.resetPassword(userId, resetPasswordDto.newPassword);
  }
}