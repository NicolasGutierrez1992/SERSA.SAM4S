import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { BackupLog, EstadoBackup } from './entities/backup-log.entity';
import { AppSettingsService } from '../common/services/app-settings.service';
import { MailService } from '../common/services/mail.service';

interface DriveFile {
  id: string;
  name: string;
  createdTime: string;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    @InjectRepository(BackupLog)
    private readonly backupLogRepository: Repository<BackupLog>,
    private readonly appSettingsService: AppSettingsService,
    private readonly mailService: MailService,
  ) {}

  // OJO: este decorador evalúa process.env.BACKUP_CRON al importar la clase,
  // ANTES de que ConfigModule.forRoot() cargue .env — en dev local sin Docker
  // (npm run start:dev), un BACKUP_CRON puesto solo en .env no tiene efecto y
  // cae al default. En Railway y en Docker Compose (env_file) sí funciona,
  // porque esas plataformas inyectan las variables al proceso antes de que
  // Node arranque.
  @Cron(process.env.BACKUP_CRON || '0 3 * * *', {
    name: 'daily-database-backup',
  })
  async runScheduledBackup(): Promise<void> {
    await this.runBackup();
  }

  async runBackup(): Promise<BackupLog> {
    const startedAt = Date.now();
    let dumpPath: string | null = null;

    try {
      dumpPath = await this.createDump();
      const stats = await fsp.stat(dumpPath);
      const fileName = path.basename(dumpPath);

      const driveAccessToken = await this.getGoogleAccessToken();
      const driveFileId = await this.uploadToDrive(
        driveAccessToken,
        dumpPath,
        fileName,
      );
      await this.applyRetention(driveAccessToken);

      const log = this.backupLogRepository.create({
        estado: EstadoBackup.EXITOSO,
        nombre_archivo: fileName,
        tamano_bytes: stats.size,
        drive_file_id: driveFileId,
        duracion_ms: Date.now() - startedAt,
      });
      const saved = await this.backupLogRepository.save(log);
      this.logger.log(
        `Backup exitoso: ${fileName} (${stats.size} bytes) -> Drive ${driveFileId}`,
      );
      return saved;
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      this.logger.error(`Backup fallido: ${mensaje}`);

      const log = this.backupLogRepository.create({
        estado: EstadoBackup.FALLIDO,
        error_mensaje: mensaje,
        duracion_ms: Date.now() - startedAt,
      });
      const saved = await this.backupLogRepository.save(log);
      await this.notificarFallo(mensaje);
      return saved;
    } finally {
      if (dumpPath) {
        await fsp.rm(dumpPath, { force: true });
      }
    }
  }

  async getStatus(limit = 20): Promise<BackupLog[]> {
    return this.backupLogRepository.find({
      order: { fecha: 'DESC' },
      take: limit,
    });
  }

  private createDump(): Promise<string> {
    const fecha = new Date().toISOString().slice(0, 10);
    const dumpPath = path.join(
      os.tmpdir(),
      `sersa-backup-${fecha}-${Date.now()}.dump`,
    );

    const dbSSL = process.env.DB_SSL === 'true';
    const args = [
      '-h',
      process.env.DB_HOST || 'localhost',
      '-p',
      process.env.DB_PORT || '5432',
      '-U',
      process.env.DB_USERNAME || 'postgres',
      '-d',
      process.env.DB_NAME || 'db_sersa',
      '-F',
      'c',
      '--no-owner',
      '--no-privileges',
      '-f',
      dumpPath,
    ];

    return new Promise((resolve, reject) => {
      const child = spawn('pg_dump', args, {
        env: {
          ...process.env,
          PGPASSWORD: process.env.DB_PASSWORD || '',
          PGSSLMODE: dbSSL ? 'require' : 'disable',
        },
      });

      let stderr = '';
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        reject(new Error(`No se pudo ejecutar pg_dump: ${err.message}`));
      });

      child.on('close', (code) => {
        if (code === 0 && fs.existsSync(dumpPath)) {
          // El dump completo de la base es el archivo más sensible que este
          // proceso toca — restringir lectura/escritura solo al dueño, aunque
          // sea temporal y el contenedor sea de un solo tenant.
          try {
            fs.chmodSync(dumpPath, 0o600);
          } catch (chmodError) {
            this.logger.warn(
              `No se pudo restringir permisos del dump temporal: ${chmodError}`,
            );
          }
          resolve(dumpPath);
        } else {
          reject(new Error(`pg_dump terminó con código ${code}: ${stderr}`));
        }
      });
    });
  }

  // Reusa el mismo cliente OAuth2 (refresh token de una cuenta real de Google)
  // que ya usa auditoria.service.ts para mandar mails. El refresh token debe
  // tener los scopes gmail.send Y drive.file — ver backend/.env.example.
  // No se usa una service account: en Drive normal (no Workspace) las service
  // accounts no tienen cuota propia de almacenamiento y no pueden subir archivos
  // aunque se les comparta una carpeta como Editor.
  private async getGoogleAccessToken(): Promise<string> {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error(
        'Faltan variables de OAuth2 de Google (GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN)',
      );
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
    };
    if (!tokenData.access_token) {
      throw new Error(
        `No se pudo obtener access token de Gmail: ${tokenData.error}`,
      );
    }
    return tokenData.access_token;
  }

  private async uploadToDrive(
    accessToken: string,
    filePath: string,
    fileName: string,
  ): Promise<string> {
    const folderId = process.env.GDRIVE_BACKUP_FOLDER_ID;
    if (!folderId) {
      throw new Error('Falta GDRIVE_BACKUP_FOLDER_ID');
    }

    const boundary = 'sersa-backup-boundary';
    const metadata = { name: fileName, parents: [folderId] };
    const fileBuffer = await fsp.readFile(filePath);

    const head = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: application/octet-stream\r\n\r\n`,
    );
    const tail = Buffer.from(`\r\n--${boundary}--`);
    const body = Buffer.concat([head, fileBuffer, tail]);

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Error subiendo backup a Drive: ${err}`);
    }

    const data = (await res.json()) as { id: string };
    return data.id;
  }

  private async applyRetention(accessToken: string): Promise<void> {
    const folderId = process.env.GDRIVE_BACKUP_FOLDER_ID;
    const retentionDays = parseInt(
      process.env.BACKUP_RETENTION_DAYS || '14',
      10,
    );

    const query = encodeURIComponent(
      `'${folderId}' in parents and name contains 'sersa-backup-' and trashed = false`,
    );
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,createdTime)&pageSize=1000`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!res.ok) {
      this.logger.warn(
        `No se pudo listar backups en Drive para aplicar retención: ${await res.text()}`,
      );
      return;
    }

    const data = (await res.json()) as { files: DriveFile[] };
    const fechaCorte = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    for (const file of data.files || []) {
      if (new Date(file.createdTime).getTime() < fechaCorte) {
        const delRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${file.id}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
        if (delRes.ok) {
          this.logger.log(`Backup antiguo eliminado de Drive: ${file.name}`);
        } else {
          this.logger.warn(
            `No se pudo eliminar backup antiguo ${file.name}: ${await delRes.text()}`,
          );
        }
      }
    }
  }

  private async notificarFallo(mensaje: string): Promise<void> {
    try {
      const adminMailTo =
        await this.appSettingsService.obtenerSetting('ADMIN_MAIL_TO');
      if (!adminMailTo) {
        this.logger.warn('Falta ADMIN_MAIL_TO en app_settings');
        return;
      }

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; color: #222;">
          <h2 style="color: #b91c1c;">⚠️ Falló el backup automático de la base de datos</h2>
          <p>El backup diario programado no se pudo completar.</p>
          <p><b>Error:</b> ${mensaje}</p>
          <p style="margin-top:20px;">Por favor revise el sistema a la brevedad.</p>
          <hr style="margin:24px 0;"/>
          <p style="font-size:0.95em; color:#555;">Saludos,<br/>Sistema SERSA</p>
        </div>`;

      await this.mailService.sendMail(
        adminMailTo,
        '⚠️ Falló el backup automático de la base de datos',
        htmlBody,
      );
    } catch (error) {
      this.logger.error(
        'Error notificando fallo de backup por mail',
        error as Error,
      );
    }
  }
}
