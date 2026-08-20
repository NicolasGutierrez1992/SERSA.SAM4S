import { Injectable, Logger } from '@nestjs/common';

/**
 * Envío de mail vía Gmail OAuth2 (intercambio de refresh token + RFC2822 +
 * POST a la API REST de Gmail, sin SMTP — Railway bloquea SMTP saliente).
 * Extraído de auditoria.service.ts/backup.service.ts, que tenían este mismo
 * bloque duplicado — ver CLAUDE.md.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async getAccessToken(): Promise<string> {
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

  /**
   * Envía un mail HTML. `to` puede ser una o varias direcciones separadas
   * por coma (así lo interpreta el header RFC2822 To:).
   */
  async sendMail(to: string, subject: string, html: string): Promise<void> {
    const adminMailUser = process.env.ADMIN_MAIL_USER;
    if (!adminMailUser) {
      this.logger.warn('Falta ADMIN_MAIL_USER, no se puede enviar el mail');
      return;
    }

    const accessToken = await this.getAccessToken();

    const rfc2822 = [
      `From: SERSA Notificaciones <${adminMailUser}>`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      html,
    ].join('\r\n');

    const encodedEmail = Buffer.from(rfc2822).toString('base64url');

    const sendRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: encodedEmail }),
      },
    );

    if (!sendRes.ok) {
      const err = await sendRes.text();
      throw new Error(`Error enviando mail via Gmail API: ${err}`);
    }
  }
}
