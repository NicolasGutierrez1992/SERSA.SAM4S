import { Injectable } from '@nestjs/common';

/**
 * Servicio para manejar fechas en zona horaria de Argentina (Buenos Aires)
 * Zona horaria: America/Argentina/Buenos_Aires (UTC-3)
 */
@Injectable()
export class TimezoneService {
  /**
   * Obtener fecha/hora actual en zona horaria de Argentina
   */
  getNowArgentina(): Date {
    return this.convertToArgentina(new Date());
  }

  /**
   * Obtener string de fecha actual en formato YYYY-MM-DD (Argentina)
   */
  getTodayString(): string {
    return this.formatDateToString(this.getNowArgentina());
  }

  /**
   * Convertir una fecha a zona horaria de Argentina
   */
  convertToArgentina(date: Date): Date {
    // Argentina está en UTC-3 (o UTC-2 durante horario de verano, pero generalmente -3)
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(date);
    const year = parseInt(parts.find(p => p.type === 'year')!.value);
    const month = parseInt(parts.find(p => p.type === 'month')!.value) - 1;
    const day = parseInt(parts.find(p => p.type === 'day')!.value);
    const hour = parseInt(parts.find(p => p.type === 'hour')!.value);
    const minute = parseInt(parts.find(p => p.type === 'minute')!.value);
    const second = parseInt(parts.find(p => p.type === 'second')!.value);

    return new Date(year, month, day, hour, minute, second);
  }

  /**
   * Formatear fecha a string YYYY-MM-DD en zona horaria Argentina
   */
  formatDateToString(date: Date): string {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')!.value;
    const month = parts.find(p => p.type === 'month')!.value;
    const day = parts.find(p => p.type === 'day')!.value;

    return `${year}-${month}-${day}`;
  }

  /**
   * Formatear fecha completa a string legible en zona horaria Argentina
   */
  formatDateTimeFull(date: Date): string {
    const formatter = new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    return formatter.format(date);
  }

  /**
   * Obtener inicio del día en Argentina (00:00:00)
   */
  getStartOfDayArgentina(date?: Date): Date {
    const dateArg = date ? this.convertToArgentina(date) : this.getNowArgentina();
    return new Date(dateArg.getFullYear(), dateArg.getMonth(), dateArg.getDate(), 0, 0, 0);
  }

  /**
   * Obtener fin del día en Argentina (23:59:59)
   */
  getEndOfDayArgentina(date?: Date): Date {
    const dateArg = date ? this.convertToArgentina(date) : this.getNowArgentina();
    return new Date(dateArg.getFullYear(), dateArg.getMonth(), dateArg.getDate(), 23, 59, 59);
  }

  /**
   * Obtener inicio de la semana en Argentina (lunes)
   */
  getStartOfWeekArgentina(date?: Date): Date {
    const dateArg = date ? this.convertToArgentina(date) : this.getNowArgentina();
    const day = dateArg.getDay();
    const diff = dateArg.getDate() - day + (day === 0 ? -6 : 1); // Ajustar cuando el día es domingo
    return new Date(dateArg.getFullYear(), dateArg.getMonth(), diff, 0, 0, 0);
  }

  /**
   * Obtener inicio del mes en Argentina
   */
  getStartOfMonthArgentina(date?: Date): Date {
    const dateArg = date ? this.convertToArgentina(date) : this.getNowArgentina();
    return new Date(dateArg.getFullYear(), dateArg.getMonth(), 1, 0, 0, 0);
  }

  /**
   * Comparar si dos fechas son el mismo día en Argentina
   */
  isSameDayArgentina(date1: Date, date2: Date): boolean {
    const d1 = this.convertToArgentina(date1);
    const d2 = this.convertToArgentina(date2);
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }

  /**
   * Comparar si una fecha es "hoy" en Argentina
   */
  isTodayArgentina(date: Date): boolean {
    return this.isSameDayArgentina(date, new Date());
  }

  /**
   * Obtener diferencia en días entre dos fechas (en Argentina)
   */
  getDaysDifferenceArgentina(date1: Date, date2: Date): number {
    const d1 = this.getStartOfDayArgentina(date1);
    const d2 = this.getStartOfDayArgentina(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Obtener número de semana (ISO) en Argentina
   */
  getWeekNumberArgentina(date?: Date): number {
    const dateArg = date ? this.convertToArgentina(date) : this.getNowArgentina();
    const d = new Date(dateArg.getFullYear(), dateArg.getMonth(), dateArg.getDate());
    const dayNum = d.getDay() || 7;
    d.setDate(d.getDate() - dayNum + 1);
    const firstThursday = new Date(d.getFullYear(), 0, 4);
    const dayNum2 = firstThursday.getDay() || 7;
    firstThursday.setDate(firstThursday.getDate() - dayNum2 + 1);
    const diff = d.getTime() - firstThursday.getTime();
    return Math.round(diff / 604800000) + 1;
  }
}
