import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationLimitPrepagoToUsers1756000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_limit_prepago INTEGER DEFAULT 10;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE users DROP COLUMN IF EXISTS notification_limit_prepago;`,
    );
  }
}
