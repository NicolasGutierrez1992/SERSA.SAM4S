import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cambia las columnas pfx_data y file_data de bytea a text
 * para almacenar datos encriptados con AES-256 en formato base64.
 *
 * IMPORTANTE: Los registros existentes quedan marcados como 'MIGRATION_REQUIRED'.
 * Después de aplicar esta migración hay que re-subir el certificado.pfx
 * y el Root_RTI.txt desde el panel de administración.
 */
export class EncryptAfipCerts1748000001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // certificados_maestro: pfx_data bytea → text
    await queryRunner.query(`
      ALTER TABLE certificados_maestro
        ALTER COLUMN pfx_data TYPE text USING 'MIGRATION_REQUIRED';
    `);

    // afip_files: file_data bytea → text
    await queryRunner.query(`
      ALTER TABLE afip_files
        ALTER COLUMN file_data TYPE text USING 'MIGRATION_REQUIRED';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertir a bytea (los datos encriptados se pierden, columna queda vacía)
    await queryRunner.query(`
      ALTER TABLE certificados_maestro
        ALTER COLUMN pfx_data TYPE bytea USING NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE afip_files
        ALTER COLUMN file_data TYPE bytea USING NULL;
    `);
  }
}
