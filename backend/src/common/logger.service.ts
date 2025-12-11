import { Injectable } from '@nestjs/common';
import { TimezoneService } from './timezone.service';

@Injectable()
export class LoggerService {
  private readonly timezoneService = new TimezoneService();

  private getTimestampArgentina(): string {
    // Retorna formato: HH:MM:SS (solo la hora)
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Argentina/Buenos_Aires',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    return formatter.format(new Date());
  }

  info(context: string, message: string, data?: any) {
    const timestamp = this.getTimestampArgentina();
    console.log(`[${timestamp}] [INFO] [${context}] ${message}`, data ?? '');
  }

  error(context: string, message: string, error?: any) {
    const timestamp = this.getTimestampArgentina();
    console.error(`[${timestamp}] [ERROR] [${context}] ${message}`, error ?? '');
  }

  debug(context: string, message: string, data?: any) {
    if (process.env.NODE_ENV !== 'production') {
      const timestamp = this.getTimestampArgentina();
      console.debug(`[${timestamp}] [DEBUG] [${context}] ${message}`, data ?? '');
    }
  }
}
