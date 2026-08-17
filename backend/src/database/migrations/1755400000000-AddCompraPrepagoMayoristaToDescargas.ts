import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompraPrepagoMayoristaToDescargas1755400000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE descargas ADD COLUMN IF NOT EXISTS id_compra_prepago_mayorista INTEGER;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE descargas DROP COLUMN IF EXISTS id_compra_prepago_mayorista;
    `);
  }
}
