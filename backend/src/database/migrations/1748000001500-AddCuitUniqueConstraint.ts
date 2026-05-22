import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCuitUniqueConstraint1748000001500 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ON CONFLICT (cuit) en SeedBaseData requiere un índice único sobre cuit
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_cuit ON users(cuit);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_cuit;`);
  }
}
