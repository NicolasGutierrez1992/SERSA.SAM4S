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
    }),    // Módulo de autenticación global PRIMERO
    SharedAuthModule,    // Configuración de TypeORM con PostgreSQL
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const dbHost = configService.get('DB_HOST');
        const dbPort = parseInt(configService.get('DB_PORT')) || 5432;
        const dbUsername = configService.get('DB_USERNAME');
        const dbName = configService.get('DB_NAME');
        const dbSSL = configService.get('DB_SSL') === 'true';
        const nodeEnv = configService.get('NODE_ENV');

        console.log('\n🔌 DATABASE CONNECTION CONFIGURATION');
        console.log('=====================================');
        console.log(`Host: ${dbHost}`);
        console.log(`Port: ${dbPort}`);
        console.log(`Username: ${dbUsername}`);
        console.log(`Database: ${dbName}`);
        console.log(`SSL Enabled: ${dbSSL}`);
        console.log(`Environment: ${nodeEnv}`);
        console.log(`Synchronize: true (auto-create tables)`);
        console.log('=====================================\n');

        return {
          type: 'postgres',
          host: dbHost,
          port: dbPort,
          username: dbUsername,
          password: configService.get('DB_PASSWORD'),
          database: dbName,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: true, // Habilitado para crear tablas automáticamente
          migrationsRun: false, // No ejecutar migraciones automáticamente
          dropSchema: false, // Nunca eliminar el esquema
          ssl: dbSSL ? { rejectUnauthorized: false } : false,
          logging: nodeEnv === 'development' || nodeEnv === 'production', // Habilitar logs en ambos
          logger: 'advanced-console', // Mejor logging de queries
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