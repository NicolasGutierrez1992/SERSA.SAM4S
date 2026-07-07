import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDistribuidorFacturaColumns1751900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE descargas ADD COLUMN IF NOT EXISTS numero_factura_distribuidor VARCHAR(255);
      ALTER TABLE descargas ADD COLUMN IF NOT EXISTS referencia_pago_distribuidor VARCHAR(255);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE descargas DROP COLUMN IF EXISTS numero_factura_distribuidor;
      ALTER TABLE descargas DROP COLUMN IF EXISTS referencia_pago_distribuidor;
    `);
  }
}
