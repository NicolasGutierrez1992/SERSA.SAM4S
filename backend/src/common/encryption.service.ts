import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly encryptionKey: Buffer;
  private readonly algorithm = 'aes-256-cbc';

  constructor(private configService: ConfigService) {
    // Obtener la clave de encriptación desde variables de entorno
    const keyString = this.configService.get<string>('ENCRYPTION_KEY');
    
    if (!keyString) {
      this.logger.warn(
        'ENCRYPTION_KEY no configurada en variables de entorno. ' +
        'Generando clave temporal. Para producción, configure ENCRYPTION_KEY.'
      );
      // En desarrollo, generar una clave temporal (NO usar en producción)
      this.encryptionKey = crypto.scryptSync('default-key-change-in-production', 'salt', 32);
    } else {
      // La clave debe tener exactamente 32 bytes (256 bits) para AES-256
      if (keyString.length === 64) {
        // Si es hex (64 caracteres = 32 bytes)
        this.encryptionKey = Buffer.from(keyString, 'hex');
      } else {
        // Derivar la clave usando scrypt
        this.encryptionKey = crypto.scryptSync(keyString, 'salt', 32);
      }
    }
  }

  /**
   * Encriptar datos
   * @param data Datos a encriptar (string o Buffer)
   * @returns Datos encriptados en formato base64
   */  encrypt(data: string | Buffer): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
      
      let encrypted: Buffer;
      if (typeof data === 'string') {
        encrypted = cipher.update(data, 'utf8');
      } else {
        encrypted = cipher.update(data);
      }
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      
      // Retornar IV + datos encriptados en base64
      const result = Buffer.concat([iv, encrypted]).toString('base64');
      return result;
    } catch (error) {
      this.logger.error('Error encriptando datos', error);
      throw error;
    }
  }

  /**
   * Desencriptar datos
   * @param encryptedData Datos encriptados en formato base64
   * @returns Datos desencriptados en string
   */
  decrypt(encryptedData: string): string {
    try {
      const buffer = Buffer.from(encryptedData, 'base64');
      
      // Los primeros 16 bytes son el IV
      const iv = buffer.slice(0, 16);
      const encrypted = buffer.slice(16);
      
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      this.logger.error('Error desencriptando datos', error);
      throw error;
    }
  }

  /**
   * Desencriptar datos a Buffer
   * @param encryptedData Datos encriptados en formato base64
   * @returns Datos desencriptados como Buffer
   */
  decryptToBuffer(encryptedData: string): Buffer {
    try {
      const buffer = Buffer.from(encryptedData, 'base64');
      
      // Los primeros 16 bytes son el IV
      const iv = buffer.slice(0, 16);
      const encrypted = buffer.slice(16);
      
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      return decrypted;
    } catch (error) {
      this.logger.error('Error desencriptando datos a Buffer', error);
      throw error;
    }
  }

  /**
   * Generar una clave de encriptación segura (para fines de configuración)
   */
  static generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
