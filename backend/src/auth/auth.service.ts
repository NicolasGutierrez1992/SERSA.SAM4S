import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto, ChangePasswordDto, JwtPayload, LoginResponse } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(cuit: string, password: string): Promise<any> {
    // Incluye todos los campos del usuario, incluido id_mayorista
    const user = await this.usersService.findByCuit(cuit);
    
    if (!user) {
      return null;
    }

    if (user.status === 0) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    try {
      // Logs adicionales para depuración de comparación de passwords (sin datos sensibles)
      console.log('[AuthService][validateUser] Comparando contraseña recibida con hash almacenado.');
      const isPasswordValid = await bcrypt.compare(password, user.password);
      console.log('[AuthService][validateUser] Resultado bcrypt.compare:', isPasswordValid ? 'MATCH' : 'NO_MATCH');
      if (!isPasswordValid) {
        return null;
      }
    } catch (err) {
      console.error('[AuthService][validateUser] Error en bcrypt.compare:', err);
      return null;
    }

    // Excluir password del objeto retornado
    const { password: _, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto, ip?: string): Promise<LoginResponse> {
    const user = await this.validateUser(loginDto.cuit, loginDto.password);
    
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }    // Actualizar último login
    await this.usersService.updateLastLogin(user.id_usuario);    // Crear payload JWT
    const payload: JwtPayload = {
      id: user.id_usuario,
      cuit: user.cuit,
      nombre: user.nombre,
      rol: user.rol,
      mustChangePassword: user.must_change_password,
      id_mayorista: user.id_mayorista // <-- Asegurarse de incluirlo en el payload
    };

    const access_token = this.jwtService.sign(payload);         
    return {
      access_token,
      user: {
        id: user.id_usuario,
        cuit: user.cuit,
        nombre: user.nombre,
        email: user.mail,
        rol: user.rol,
        must_change_password: user.must_change_password,
        last_login: user.ultimo_login,
        id_mayorista: user.id_mayorista, // <-- Agregado para el frontend
        limite_descargas: user.limite_descargas // <-- Agregado para el frontend
      },
    };
  }
  
  async changePassword(userId: number, changePasswordDto: ChangePasswordDto): Promise<void> {
    const user = await this.usersService.findOne(userId);
    
    // Obtener el usuario completo con password para validación
    const fullUser = await this.usersService.findByCuit(user.cuit);
    
    // Verificar que la nueva contraseña sea diferente
    const isSamePassword = await bcrypt.compare(
      changePasswordDto.newPassword,
      fullUser.password
    );
    
    if (isSamePassword) {
      throw new BadRequestException('La nueva contraseña debe ser diferente a la actual');
    }

    // Actualizar contraseña
    await this.usersService.updatePassword(userId, changePasswordDto.newPassword, false);
  }

  async resetPassword(userId: number, newPassword: string): Promise<void> {
    // Solo administradores pueden resetear contraseñas
    await this.usersService.updatePassword(userId, newPassword, true);
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new UnauthorizedException('Token inválido');
    }
  }
}