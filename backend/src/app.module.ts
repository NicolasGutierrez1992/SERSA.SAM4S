import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Módulo de autenticación global PRIMERO
import { SharedAuthModule } from './auth/shared-auth.module';

// Luego los demás módulos
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CertificadosModule } from './certificados/certificados.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { AfipModule } from './afip/afip.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Módulo de autenticación global PRIMERO
    SharedAuthModule,
      // Configuración de TypeORM con PostgreSQL    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: parseInt(configService.get('DB_PORT')) || 5432,
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: true, // Habilitado para crear tablas automáticamente
        migrationsRun: false, // No ejecutar migraciones automáticamente
        dropSchema: false, // Nunca eliminar el esquema
        ssl: configService.get('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
        logging: configService.get('NODE_ENV') === 'development',
      }),
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
    AuthModule,
    UsersModule,
    CertificadosModule,
    AuditoriaModule,
    AfipModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}