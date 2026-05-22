import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationLimitToUsers1734278400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_limit INTEGER DEFAULT 100;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS notification_limit;`);
  }
}
