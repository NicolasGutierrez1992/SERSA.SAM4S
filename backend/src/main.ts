import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Configurar CORS
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      process.env.FRONTEND_URL || 'http://localhost:3000'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Configurar prefijo global para todas las rutas
  app.setGlobalPrefix('api');

  // Configurar validación global
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));
  // Configurar Swagger
  const config = new DocumentBuilder()
    .setTitle('SERSA API')
    .setDescription('Sistema de gestión de certificados CRS - PRODUCCIÓN')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Health Check', 'Endpoints de estado del sistema')
    .addTag('Certificados CRS', 'Gestión de certificados AFIP')
    .addTag('Usuarios', 'Gestión de usuarios y roles')
    .addTag('Auditoría', 'Logs y trazabilidad del sistema')
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'SERSA API Documentation',
    explorer: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 SERSA Backend running on: http://localhost:${port}/api`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
  console.log(`💡 Health Check: http://localhost:${port}/api/health`);
  console.log(`✅ Running in PRODUCTION mode with real AFIP integration`);
}

bootstrap();