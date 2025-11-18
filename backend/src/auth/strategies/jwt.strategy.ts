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
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // El payload ya contiene la información del usuario
    // Solo verificamos que el token sea válido y no esté expirado
    if (!payload.id || !payload.cuit) {
      throw new UnauthorizedException('Token inválido');
    }

    return payload;
  }
}