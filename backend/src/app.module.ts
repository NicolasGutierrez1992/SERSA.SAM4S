import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Módulo de autenticación global PRIMERO
import { SharedAuthModule } from './auth/shared-auth.module';

// Luego los demás módulos
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CertificadosModule } from './certificados/certificados.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { AfipModule } from './afip/afip.module';
import { AppInitializerService } from './common/app-initializer.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),    // Módulo de autenticación global PRIMERO
    SharedAuthModule,    // Configuración de TypeORM con PostgreSQL
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get('NODE_ENV');
        const dbSSL = configService.get('DB_SSL') === 'true';
        const isProduction = nodeEnv === 'production';

        return {
          type: 'postgres',
          host: configService.get('DB_HOST'),
          port: parseInt(configService.get('DB_PORT')) || 5432,
          username: configService.get('DB_USERNAME'),
          password: configService.get('DB_PASSWORD'),
          database: configService.get('DB_NAME'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
          // synchronize:true en producción puede modificar/perder datos — usar migraciones
          synchronize: !isProduction,
          migrationsRun: isProduction,
          dropSchema: false,
          // SSL: por defecto rejectUnauthorized=true para evitar MITM.
          // Railway usa certificado autofirmado en el proxy público; si la conexión
          // falla, configurar DB_SSL_REJECT_UNAUTHORIZED=false en Railway + documentar motivo.
          ssl: dbSSL
            ? {
                rejectUnauthorized:
                  configService.get('DB_SSL_REJECT_UNAUTHORIZED') !== 'false',
              }
            : false,
          // Solo loguear errores SQL en producción para no exponer datos en logs
          logging: isProduction ? ['error'] : 'all',
          logger: 'advanced-console',
        };
      },
      inject: [ConfigService],
    }),
    
    // Throttling para rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          ttl: parseInt(configService.get('THROTTLE_TTL')) * 1000 || 60000, // 1 minuto
          limit: parseInt(configService.get('THROTTLE_LIMIT')) || 100, // 100 requests por minuto
        },
      ],
      inject: [ConfigService],
    }),    
    // Módulos funcionales
    CommonModule,
    AuthModule,
    UsersModule,
    CertificadosModule,
    AuditoriaModule,
    AfipModule,
  ],
  controllers: [AppController],
  providers: [AppService, AppInitializerService],
})
export class AppModule {}