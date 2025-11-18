import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { AuditoriaService, AuditoriaAccion, AuditoriaEntidad } from '../../auditoria/auditoria.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as any;
    
    if (!user) {
      return next.handle();
    }

    const { method, url, body } = request;
    const ip = request.ip || request.connection.remoteAddress || '0.0.0.0';

    const { accion, entidad } = this.determineActionAndEntity(method, url);
    
    if (!accion || !entidad) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: (response) => {
          this.auditoriaService.log(
            user.sub,
            accion,
            entidad,
            this.extractEntityId(response, body),
            this.extractOldValues(body),
            this.extractNewValues(response),
            ip
          ).catch(error => console.error('Error logging audit:', error));
        },
        error: (error) => {
          console.error('Error en interceptor de auditoría:', error);
        }
      })
    );
  }

  private determineActionAndEntity(method: string, url: string): { accion?: AuditoriaAccion; entidad?: AuditoriaEntidad } {
    if (url.includes('/users')) {
      const entidad = AuditoriaEntidad.USER;
      if (method === 'POST') return { accion: AuditoriaAccion.CREAR, entidad };
      if (method === 'PATCH' || method === 'PUT') return { accion: AuditoriaAccion.ACTUALIZAR, entidad };
      if (method === 'DELETE') return { accion: AuditoriaAccion.ELIMINAR, entidad };
    }
    
    if (url.includes('/certificados') && method === 'POST') {
      return { accion: AuditoriaAccion.DESCARGAR, entidad: AuditoriaEntidad.CERTIFICADO };
    }
    
    if (url.includes('/auth/login')) {
      return { accion: AuditoriaAccion.LOGIN, entidad: AuditoriaEntidad.USER };
    }

    return {};
  }

  private extractEntityId(response: any, body: any): number | undefined {
    return response?.id || body?.id;
  }

  private extractOldValues(body: any): any {
    return null;
  }

  private extractNewValues(response: any): any {
    return response;
  }
}