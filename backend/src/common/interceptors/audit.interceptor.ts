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
    const userAgent = request.headers['user-agent'] || '';

    // Determinar acción y entidad basado en la ruta y método
    const { accion, entidad } = this.determineActionAndEntity(method, url);
    
    if (!accion || !entidad) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({        next: (response) => {
          // Registrar auditoría exitosa
          this.auditoriaService.log(
            user.sub,
            accion,
            entidad,
            this.extractEntityId(response, body),
            this.extractOldValues(body),
            this.extractNewValues(response),
            ip
          );
        },
        error: (error) => {
          // Registrar auditoría de error si es necesario
          console.error('Error en interceptor de auditoría:', error);
        }
      })
    );
  }

  private determineActionAndEntity(method: string, url: string): { accion?: AuditoriaAccion; entidad?: AuditoriaEntidad } {
    // ...existing code... (lógica para determinar acción y entidad)
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
    // ...existing code... (extraer ID de la entidad)
    return response?.id || body?.id;
  }

  private extractOldValues(body: any): any {
    // ...existing code... (extraer valores anteriores si es una actualización)
    return null;
  }

  private extractNewValues(response: any): any {
    // ...existing code... (extraer valores nuevos)
    return response;
  }
}