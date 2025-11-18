import { Injectable } from '@nestjs/common';

@Injectable()
export class LoggerService {
  info(context: string, message: string, data?: any) {
    console.log(`[INFO] [${context}] ${message}`, data ?? '');
  }

  error(context: string, message: string, error?: any) {
    console.error(`[ERROR] [${context}] ${message}`, error ?? '');
  }

  debug(context: string, message: string, data?: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] [${context}] ${message}`, data ?? '');
    }
  }
}
