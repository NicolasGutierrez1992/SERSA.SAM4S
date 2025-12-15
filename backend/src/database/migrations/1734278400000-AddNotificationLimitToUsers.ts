import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddNotificationLimitToUsers1734278400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Agregar columna notification_limit a la tabla users
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'notification_limit',
        type: 'integer',
        isNullable: true,
        default: 100,
        comment: 'Límite de descargas pendientes para notificación (solo para mayoristas, rol=2)'
      })
    );

    console.log('✅ Columna notification_limit agregada a la tabla users');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertir: eliminar la columna
    await queryRunner.dropColumn('users', 'notification_limit');

    console.log('⏮️ Columna notification_limit eliminada de la tabla users');
  }
}
