import { NestFactory, NestApplication } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { TimezoneService } from './common/timezone.service';

const logger = new Logger('Bootstrap');

function validateRequiredEnv(): void {
  const required = ['JWT_SECRET', 'ENCRYPTION_KEY', 'DB_PASSWORD'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Variables de entorno requeridas no configuradas: ${missing.join(', ')}. ` +
        'Configúralas en Railway (producción) o en backend/.env.docker (local).',
    );
  }
}

async function bootstrap() {
  validateRequiredEnv();

  const app = await NestFactory.create(AppModule);
  const timezoneService = new TimezoneService();
  const isProduction = process.env.NODE_ENV === 'production';

  // Headers de seguridad HTTP
  app.use(helmet());

  // Parseo de cookies (requerido para auth httpOnly)
  app.use(cookieParser());

  // CORS
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((url) => url.trim())
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    optionsSuccessStatus: 200,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger — solo en entornos no-productivos
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('SERSA API')
      .setDescription('Sistema de gestión de certificados CRS')
      .setVersion('1.0.0')
      .addBearerAuth()
      .addCookieAuth('auth_token')
      .addTag('Health Check', 'Endpoints de estado del sistema')
      .addTag('Certificados CRS', 'Gestión de certificados AFIP')
      .addTag('Usuarios', 'Gestión de usuarios y roles')
      .addTag('Auditoría', 'Logs y trazabilidad del sistema')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: 'SERSA API Documentation',
    });
    logger.log('Swagger disponible en /api/docs (solo en desarrollo)');
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);

  const horaArgentina = timezoneService.formatDateTimeFull(new Date());
  logger.log(`Backend corriendo en puerto ${port}`);
  logger.log(`Entorno: ${process.env.NODE_ENV}`);
  logger.log(`Hora Argentina: ${horaArgentina}`);
}

bootstrap();