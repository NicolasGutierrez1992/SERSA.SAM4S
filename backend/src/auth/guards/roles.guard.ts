import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/dto/user.dto';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    console.log('\n========== [RolesGuard] INICIANDO VALIDACIÓN ==========');
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    console.log('[RolesGuard] Roles requeridos:', requiredRoles);
    
    if (!requiredRoles) {
      console.log('[RolesGuard] ✅ No hay roles requeridos - permitiendo acceso');
      return true; // No hay roles requeridos
    }

    const { user } = context.switchToHttp().getRequest();
    console.log('[RolesGuard] Usuario en request:', JSON.stringify(user, null, 2));
    
    if (!user) {
      console.error('[RolesGuard] ❌ No hay usuario en el request');
      return false;
    }

    // Permitir coincidencia por user.rol o user.id_rol
    const userRole = user.rol ?? user.id_rol;
    console.log('[RolesGuard] userRole extraído:', userRole);
    console.log('[RolesGuard] Verificando si', userRole, 'está en', requiredRoles);
    
    const hasAccess = requiredRoles.some((role) => userRole === role);
    console.log('[RolesGuard] Resultado:', hasAccess ? '✅ ACCESO PERMITIDO' : '❌ ACCESO DENEGADO');
    console.log('========== [RolesGuard] FIN VALIDACIÓN ==========\n');
    
    return hasAccess;
  }
}