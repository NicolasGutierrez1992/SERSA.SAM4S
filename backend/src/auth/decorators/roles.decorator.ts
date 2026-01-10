import { SetMetadata } from '@nestjs/common';
import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '../guards/auth.guards';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: number[]) => SetMetadata(ROLES_KEY, roles);

export const RequireRoles = (...roles: number[]) => {
  return applyDecorators(
    UseGuards(JwtAuthGuard, new RolesGuard(roles))
  );
};

// Roles según el sistema
const UserRole = {
  ADMINISTRADOR: 1,
  MAYORISTA: 2,
  DISTRIBUIDOR: 3,
  FACTURACION: 4,
  TECNICO: 5,
};

// Decoradores específicos para roles
export function RequireAdmin() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, new RolesGuard([UserRole.ADMINISTRADOR]))
  );
}

export function RequireAdminOrFacturacion() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, new RolesGuard([UserRole.ADMINISTRADOR, UserRole.FACTURACION]))
  );
}

export function RequireAdminOrMayorista() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, new RolesGuard([UserRole.ADMINISTRADOR, UserRole.MAYORISTA]))
  );
}

export function RequireAuthenticated() {
  return applyDecorators(
    UseGuards(JwtAuthGuard)
  );
}

export const RequireMayorista = () => RequireRoles(2); // MAYORISTA  
export const RequireDistribuidor = () => RequireRoles(3); // DISTRIBUIDOR
export const RequireFacturacion = () => RequireRoles(4); // FACTURACION
export const RequireTecnico = () => RequireRoles(5); // TECNICO
export const RequireMayoristaOrDistribuidor = () => RequireRoles(2, 3); // MAYORISTA o DISTRIBUIDOR
export const RequireAdminOrTecnico = () => RequireRoles(1, 5); // ADMIN o TECNICO