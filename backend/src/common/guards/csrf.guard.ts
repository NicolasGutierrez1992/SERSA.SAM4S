import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
// Login no tiene sesión previa todavía (nada que un atacante pueda "reforzar" via CSRF
// más allá de forzar un login con credenciales que no controla, fuera de este alcance).
const EXEMPT_PATHS = new Set(['/api/auth/login']);

/**
 * Protección CSRF para el flujo de auth por cookie httpOnly (sameSite=none en
 * producción, requerido porque frontend y backend viven en dominios distintos).
 *
 * Patrón: el nonce `csrfToken` se emite firmado dentro del JWT en el login (ver
 * AuthService.login) y también se devuelve en el body de la respuesta. El
 * frontend lo guarda en una cookie propia (de su propio origen, no la del
 * backend) y lo reenvía como header `X-CSRF-Token` en cada request mutante. Acá
 * se valida que ese header coincida con el claim `csrfToken` del JWT ya
 * verificado — un atacante que solo logra que el navegador de la víctima
 * adjunte la cookie httpOnly (eso es CSRF) no puede conocer ni reenviar ese
 * header, porque nunca tuvo acceso de lectura al body de la respuesta de login
 * (bloqueado por same-origin policy).
 *
 * Registrado como guard global (ver app.module.ts) para cubrir todos los
 * controllers sin depender de qué decorator de auth use cada uno.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    if (SAFE_METHODS.has(req.method) || EXEMPT_PATHS.has(req.path)) {
      return true;
    }

    const token = req.cookies?.['auth_token'] || this.extraerBearer(req);
    if (!token) {
      // Sin sesión de cookie activa no hay nada que forjar vía CSRF; si la ruta
      // requiere autenticación, el guard de auth de la ruta la rechazará.
      return true;
    }

    let payload: jwt.JwtPayload | string;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET as string);
    } catch {
      // Token inválido/expirado: lo rechaza JwtAuthGuard más adelante en la
      // cadena, no es responsabilidad de este guard.
      return true;
    }

    const csrfClaim =
      typeof payload === 'object' ? payload.csrfToken : undefined;
    if (!csrfClaim) {
      // Tokens emitidos antes de este cambio no tienen el claim: se dejan pasar
      // para no invalidar sesiones activas — expiran solas dentro de 1 hora.
      return true;
    }

    const header = req.headers['x-csrf-token'];
    if (header !== csrfClaim) {
      throw new ForbiddenException('Token CSRF inválido o faltante');
    }

    return true;
  }

  private extraerBearer(req: Request): string | null {
    const auth = req.headers['authorization'];
    if (auth && auth.startsWith('Bearer ')) {
      return auth.slice(7);
    }
    return null;
  }
}
