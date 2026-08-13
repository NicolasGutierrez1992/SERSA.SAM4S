import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateBackupLogsTable1754200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'backup_logs',
        columns: [
          {
            name: 'id_backup',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'estado',
            type: 'varchar',
            length: '20',
            isNullable: false,
            comment: 'EXITOSO o FALLIDO',
          },
          {
            name: 'nombre_archivo',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'tamano_bytes',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'drive_file_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'error_mensaje',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'duracion_ms',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'fecha',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
        indices: [
          new TableIndex({
            name: 'IDX_BACKUP_LOGS_FECHA',
            columnNames: ['fecha'],
          }),
        ],
      }),
      true,
    );

    console.log('✅ Tabla backup_logs creada correctamente');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('backup_logs', true);
    console.log('⏮️ Tabla backup_logs eliminada');
  }
}
