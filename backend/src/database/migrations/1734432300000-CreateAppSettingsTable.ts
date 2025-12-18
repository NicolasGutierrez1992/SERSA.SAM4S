import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAppSettingsTable1734432300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Crear tabla app_settings para almacenar configuraciones dinámicas
    await queryRunner.createTable(
      new Table({
        name: 'app_settings',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '100',
            isPrimary: true,
            isNullable: false,
            comment: 'ID único de la configuración (ej: NOTIFICATION_LIMIT)',
          },
          {
            name: 'value',
            type: 'text',
            isNullable: false,
            comment: 'Valor de la configuración',
          },
          {
            name: 'description',
            type: 'varchar',
            length: '255',
            isNullable: true,
            comment: 'Descripción de la configuración',
          },
          {
            name: 'data_type',
            type: 'varchar',
            length: '20',
            isNullable: true,
            default: "'string'",
            comment: 'Tipo de dato: string, number, boolean',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
            comment: 'Fecha de última actualización',
          },
        ],
        indices: [
          new TableIndex({
            name: 'IDX_APP_SETTINGS_ID',
            columnNames: ['id'],
          }),
        ],
      }),
      true,
    );    // Insertar configuraciones por defecto
    await queryRunner.query(`
      INSERT INTO app_settings (id, value, description, data_type)
      VALUES 
        ('NOTIFICATION_LIMIT', '8', 'Límite de descargas pendientes para notificación', 'number'),
        ('ADMIN_MAIL_TO', 'nicolasgutierrez10492@gmail.com', 'Email del administrador para notificaciones', 'string'),
        ('CERTIFICATE_EXPIRATION_WARNING_DAYS', '30', 'Días antes del vencimiento para mostrar advertencia', 'number'),
        ('MAINTENANCE_MODE', 'false', 'Modo mantenimiento activado', 'boolean')
      ON CONFLICT DO NOTHING;
    `);

    console.log('✅ Tabla app_settings creada con valores por defecto');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertir: eliminar la tabla
    await queryRunner.dropTable('app_settings', true);
    console.log('⏮️ Tabla app_settings eliminada');
  }
}
