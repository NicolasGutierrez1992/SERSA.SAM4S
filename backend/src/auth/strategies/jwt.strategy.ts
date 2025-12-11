import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { JwtPayload } from '../dto/auth.dto';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'your-secret-key-here'),
    });
  }  async validate(payload: JwtPayload): Promise<JwtPayload> {
    console.log('\n========== [JwtStrategy] VALIDANDO TOKEN ==========');
    console.log('[JwtStrategy] Payload recibido:', JSON.stringify(payload, null, 2));
    
    // El payload ya contiene la información del usuario
    // Solo verificamos que el token sea válido y no esté expirado
    // Nota: id puede ser 0 (usuario admin), así que usar typeof en lugar de !payload.id
    if (typeof payload.id !== 'number' || !payload.cuit) {
      console.error('[JwtStrategy] ❌ Token inválido - faltan campos id o cuit');
      throw new UnauthorizedException('Token inválido');
    }

    console.log('[JwtStrategy] ✅ Token válido');
    console.log('========== [JwtStrategy] FIN VALIDACIÓN ==========\n');
    
    return payload;
  }
}