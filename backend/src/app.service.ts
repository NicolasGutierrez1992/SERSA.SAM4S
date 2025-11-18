import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor() {
    this.logger.log('SERSA Backend Service initialized');
  }

  getHello(): string {
    return 'SERSA Backend API is running! 🚀';
  }

  getHealthStatus(): object {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      message: 'SERSA Backend running in development mode',      services: {
        database: 'connected', // PostgreSQL active with TypeORM
        afip: 'production_ready', // Real AFIP services active
        auth: 'active',
        api: 'active'
      },
      endpoints: {
        api_docs: '/api/docs',
        health: '/health',
        auth: '/api/auth',
        users: '/api/users',
        certificados: '/api/certificados'
      }
    };
  }
}