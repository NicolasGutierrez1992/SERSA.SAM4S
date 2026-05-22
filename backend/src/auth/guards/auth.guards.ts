import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromRequest(request);

    if (!token) {
      throw new UnauthorizedException('Token de acceso requerido');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      request['user'] = payload;
    } catch (error) {
      throw new UnauthorizedException('Token inválido');
    }

    return true;
  }

  private extractTokenFromRequest(request: Request): string | undefined {
    // Prioridad 1: cookie httpOnly (flujo web normal)
    const cookieToken = (request as any)?.cookies?.['auth_token'];
    if (cookieToken) return cookieToken;

    // Prioridad 2: Authorization: Bearer (API / Swagger)
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly allowedRoles: number[]) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user) {
      throw new UnauthorizedException('Usuario no autenticado');
    }
    
    if (!this.allowedRoles.includes(user.rol)) {
      throw new UnauthorizedException('No tienes permisos para acceder a este recurso');
    }
    
    return true;
  }
}

@Injectable()
export class ActiveUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user) {
      throw new UnauthorizedException('Usuario no autenticado');
    }
    
    // Aquí podrías verificar en la base de datos si el usuario sigue activo
    // Por ahora asumimos que si el token es válido, el usuario está activo
    
    return true;
  }
}