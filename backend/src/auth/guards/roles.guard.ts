import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/dto/user.dto';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    console.log('[RolesGuard] ENTRA AL GUARD');
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    console.log('[RolesGuard] requiredRoles:', requiredRoles);
    if (!requiredRoles) {
      return true; // No hay roles requeridos
    }

    const { user } = context.switchToHttp().getRequest();
    console.log('[RolesGuard] user:', user);
    if (!user) {
      return false;
    }

    // Permitir coincidencia por user.rol o user.id_rol
    const userRole = user.rol ?? user.id_rol;
    console.log('[RolesGuard] requiredRoles:', requiredRoles, 'userRole:', userRole, 'user:', user);
    return requiredRoles.some((role) => userRole === role);
  }
}