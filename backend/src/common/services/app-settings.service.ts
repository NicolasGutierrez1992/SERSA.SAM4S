import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSetting } from '../entities/app-setting.entity';

export interface AppSettingValue {
  id: string;
  value: string;
  description?: string;
  data_type?: 'string' | 'number' | 'boolean';
  updated_at: Date;
}

export interface AllSettings {
  [key: string]: string;
}

@Injectable()
export class AppSettingsService {
  private readonly logger = new Logger(AppSettingsService.name);
  // Cache en memoria de configuraciones para lectura rápida
  private settingsCache: AllSettings = {};
  private lastCacheUpdate: Date = null;
  private readonly CACHE_TTL_MINUTES = 5; // Actualizar caché cada 5 minutos

  constructor(
    @InjectRepository(AppSetting)
    private readonly appSettingRepository: Repository<AppSetting>,
  ) {
    this.initializeCache();
  }

  /**
   * Inicializar caché al arrancar la aplicación
   */
  private async initializeCache(): Promise<void> {
    try {
      await this.recargarCache();
      this.logger.log('AppSettingsService cache inicializado');
    } catch (error) {
      this.logger.error('Error inicializando cache de AppSettings', error);
    }
  }

  /**
   * Recargar caché desde BD
   */
  private async recargarCache(): Promise<void> {
    try {
      const settings = await this.appSettingRepository.find();
      this.settingsCache = {};
      settings.forEach((setting) => {
        this.settingsCache[setting.id] = setting.value;
      });
      this.lastCacheUpdate = new Date();
      this.logger.debug(`Cache actualizado con ${settings.length} configuraciones`);
    } catch (error) {
      this.logger.error('Error recargando cache', error);
    }
  }

  /**
   * Obtener una configuración por key
   * Intenta obtener del caché primero, luego de BD
   */
  async obtenerSetting(key: string): Promise<string> {
    try {
      // Validar si caché necesita actualización
      if (this.needsCacheRefresh()) {
        await this.recargarCache();
      }

      // Intentar obtener del caché
      if (this.settingsCache[key]) {
        return this.settingsCache[key];
      }

      // Si no está en caché, obtener de BD
      const setting = await this.appSettingRepository.findOne({ where: { id: key } });
      if (!setting) {
        throw new NotFoundException(`Configuración ${key} no encontrada`);
      }

      // Actualizar caché
      this.settingsCache[key] = setting.value;
      return setting.value;
    } catch (error) {
      this.logger.error(`Error obteniendo setting ${key}`, error);
      throw error;
    }
  }

  /**
   * Obtener una configuración como número
   */
  async obtenerSettingNumero(key: string): Promise<number> {
    const valor = await this.obtenerSetting(key);
    const numero = parseInt(valor, 10);
    if (isNaN(numero)) {
      throw new BadRequestException(`Setting ${key} no es un número válido`);
    }
    return numero;
  }

  /**
   * Obtener una configuración como booleano
   */
  async obtenerSettingBooleano(key: string): Promise<boolean> {
    const valor = await this.obtenerSetting(key);
    return valor === 'true' || valor === '1' || valor === 'yes';
  }

  /**
   * Obtener todas las configuraciones
   */
  async obtenerTodosLosSettings(): Promise<AllSettings> {
    try {
      // Validar si caché necesita actualización
      if (this.needsCacheRefresh()) {
        await this.recargarCache();
      }

      return { ...this.settingsCache };
    } catch (error) {
      this.logger.error('Error obteniendo todos los settings', error);
      throw error;
    }
  }

  /**
   * Obtener información completa de una configuración
   */
  async obtenerInfoSetting(key: string): Promise<AppSettingValue> {
    try {
      const setting = await this.appSettingRepository.findOne({ where: { id: key } });
      if (!setting) {
        throw new NotFoundException(`Configuración ${key} no encontrada`);
      }

      return {
        id: setting.id,
        value: setting.value,
        description: setting.description,
        data_type: setting.data_type,
        updated_at: setting.updated_at,
      };
    } catch (error) {
      this.logger.error(`Error obteniendo información de setting ${key}`, error);
      throw error;
    }
  }

  /**
   * Actualizar una configuración
   */
  async actualizarSetting(key: string, nuevoValor: string): Promise<void> {
    try {
      if (!key || nuevoValor === null || nuevoValor === undefined) {
        throw new BadRequestException('Key y valor son requeridos');
      }

      const setting = await this.appSettingRepository.findOne({ where: { id: key } });
      if (!setting) {
        throw new NotFoundException(`Configuración ${key} no encontrada`);
      }

      setting.value = String(nuevoValor);
      setting.updated_at = new Date();
      await this.appSettingRepository.save(setting);

      // Actualizar caché
      this.settingsCache[key] = nuevoValor;
      this.logger.log(`Setting ${key} actualizado a: ${nuevoValor}`);
    } catch (error) {
      this.logger.error(`Error actualizando setting ${key}`, error);
      throw error;
    }
  }

  /**
   * Crear una nueva configuración
   */
  async crearSetting(
    key: string,
    valor: string,
    description?: string,
    dataType: 'string' | 'number' | 'boolean' = 'string',
  ): Promise<void> {
    try {
      if (!key) {
        throw new BadRequestException('Key es requerida');
      }

      const existente = await this.appSettingRepository.findOne({ where: { id: key } });
      if (existente) {
        throw new BadRequestException(`Configuración ${key} ya existe`);
      }

      const newSetting = this.appSettingRepository.create({
        id: key,
        value: valor,
        description,
        data_type: dataType,
      });

      await this.appSettingRepository.save(newSetting);

      // Actualizar caché
      this.settingsCache[key] = valor;
      this.logger.log(`Configuración ${key} creada con valor: ${valor}`);
    } catch (error) {
      this.logger.error(`Error creando setting ${key}`, error);
      throw error;
    }
  }

  /**
   * Listar todas las configuraciones con información completa
   */
  async listarTodosLosSettings(): Promise<AppSettingValue[]> {
    try {
      const settings = await this.appSettingRepository.find();
      return settings.map((setting) => ({
        id: setting.id,
        value: setting.value,
        description: setting.description,
        data_type: setting.data_type,
        updated_at: setting.updated_at,
      }));
    } catch (error) {
      this.logger.error('Error listando todos los settings', error);
      throw error;
    }
  }

  /**
   * Validar si el caché necesita actualización
   */
  private needsCacheRefresh(): boolean {
    if (!this.lastCacheUpdate) {
      return true;
    }
    const minutosTranscurridos =
      (new Date().getTime() - this.lastCacheUpdate.getTime()) / (1000 * 60);
    return minutosTranscurridos > this.CACHE_TTL_MINUTES;
  }

  /**
   * Forzar actualización del caché
   */
  async forceRefreshCache(): Promise<void> {
    this.logger.log('Forzando actualización de caché de AppSettings');
    await this.recargarCache();
  }

  /**
   * Obtener estadísticas del caché
   */  /**
   * Obtener todos los settings como array con información completa
   */
  async obtenerTodosLosSettingsCompleto(): Promise<AppSettingValue[]> {
    try {
      // Validar si caché necesita actualización
      if (this.needsCacheRefresh()) {
        await this.recargarCache();
      }

      // Obtener datos completos desde BD
      const settings = await this.appSettingRepository.find();
      return settings.map(setting => ({
        id: setting.id,
        value: setting.value,
        description: setting.description,
        data_type: setting.data_type as 'string' | 'number' | 'boolean',
        updated_at: setting.updated_at,
      }));
    } catch (error) {
      this.logger.error('Error obteniendo todos los settings completos', error);
      throw error;
    }
  }

  getCacheStats(): {
    totalSettings: number;
    lastUpdate: Date;
    needsRefresh: boolean;
  } {
    return {
      totalSettings: Object.keys(this.settingsCache).length,
      lastUpdate: this.lastCacheUpdate,
      needsRefresh: this.needsCacheRefresh(),
    };
  }
}
