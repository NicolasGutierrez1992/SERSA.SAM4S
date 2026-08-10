import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto, ChangePasswordDto, JwtPayload, LoginResponse } from './dto/auth.dto';
import { AuditoriaService, AuditoriaAccion, AuditoriaEntidad } from '../auditoria/auditoria.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async validateUser(cuit: string, password: string): Promise<any> {
    // Incluye todos los campos del usuario, incluido id_mayorista
    const user = await this.usersService.findByCuit(cuit);
    
    if (!user) {
      return null;
    }

    if (user.status === 3) {
      throw new UnauthorizedException('Tu cuenta está inactiva. Para más información contactá con tu proveedor.');
    }
    // status=2 (Suspendido): puede ingresar pero no puede descargar

    try {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return null;
      }
    } catch {
      return null;
    }

    // Excluir password del objeto retornado
    const { password: _, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto, ip?: string): Promise<LoginResponse> {
    let user: any;
    try {
      user = await this.validateUser(loginDto.cuit, loginDto.password);
    } catch (error) {
      await this.auditoriaService.log(
        null,
        AuditoriaAccion.LOGIN_FALLIDO,
        AuditoriaEntidad.USER,
        null,
        null,
        { cuit: loginDto.cuit, motivo: error?.message },
        ip,
      );
      throw error;
    }

    if (!user) {
      await this.auditoriaService.log(
        null,
        AuditoriaAccion.LOGIN_FALLIDO,
        AuditoriaEntidad.USER,
        null,
        null,
        { cuit: loginDto.cuit, motivo: 'Credenciales inválidas' },
        ip,
      );
      throw new UnauthorizedException('Credenciales inválidas');
    }    // Actualizar último login
    await this.usersService.updateLastLogin(user.id_usuario);    // Crear payload JWT
    const payload: JwtPayload = {
      id: user.id_usuario,
      cuit: user.cuit,
      nombre: user.nombre,
      rol: user.rol,
      mustChangePassword: user.must_change_password,
      id_mayorista: user.id_mayorista,
      status: user.status,
    };

    const access_token = this.jwtService.sign(payload);

    await this.auditoriaService.log(
      user.id_usuario,
      AuditoriaAccion.LOGIN,
      AuditoriaEntidad.USER,
      user.id_usuario,
      null,
      null,
      ip,
    );

    return {
      access_token,
      user: {
        id: user.id_usuario,
        cuit: user.cuit,
        nombre: user.nombre,
        email: user.mail,
        rol: user.rol,
        status: user.status,
        must_change_password: user.must_change_password,
        last_login: user.ultimo_login,
        id_mayorista: user.id_mayorista,
        limite_descargas: user.limite_descargas
      },
    };
  }

  async logout(userId: number, ip?: string): Promise<void> {
    await this.auditoriaService.log(
      userId,
      AuditoriaAccion.LOGOUT,
      AuditoriaEntidad.USER,
      userId,
      null,
      null,
      ip,
    );
  }
  
  async changePassword(userId: number, changePasswordDto: ChangePasswordDto): Promise<void> {
    const user = await this.usersService.findOne(userId);
    const fullUser = await this.usersService.findByCuit(user.cuit);

    // Validar contraseña actual
    const isCurrentValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      fullUser.password,
    );
    if (!isCurrentValid) {
      throw new UnauthorizedException('Contraseña actual incorrecta');
    }

    // La nueva contraseña debe ser diferente a la actual
    const isSamePassword = await bcrypt.compare(
      changePasswordDto.newPassword,
      fullUser.password,
    );
    if (isSamePassword) {
      throw new BadRequestException('La nueva contraseña debe ser diferente a la actual');
    }

    await this.usersService.updatePassword(userId, changePasswordDto.newPassword, false);
  }

}