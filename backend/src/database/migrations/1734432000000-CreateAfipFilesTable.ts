import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAfipFilesTable1734432000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Crear tabla afip_files para almacenar archivos críticos (Root_RTI, etc)
    await queryRunner.createTable(
      new Table({
        name: 'afip_files',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '50',
            isPrimary: true,
            isNullable: false,
            comment: 'ID único del archivo AFIP (ej: ROOT_RTI)',
          },
          {
            name: 'file_type',
            type: 'varchar',
            length: '20',
            isNullable: false,
            comment: 'Tipo de archivo: ROOT_RTI, CERT_BACKUP, etc',
          },
          {
            name: 'file_data',
            type: 'bytea',
            isNullable: false,
            comment: 'Datos del archivo en binario',
          },
          {
            name: 'file_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
            comment: 'Nombre original del archivo',
          },
          {
            name: 'file_size',
            type: 'int',
            isNullable: true,
            comment: 'Tamaño del archivo en bytes',
          },
          {
            name: 'activo',
            type: 'boolean',
            default: true,
            isNullable: false,
            comment: 'Indica si el archivo está activo',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
            comment: 'Fecha de creación',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
            comment: 'Fecha de última actualización',
          },
          {
            name: 'uploaded_at',
            type: 'timestamp',
            isNullable: true,
            comment: 'Fecha de carga',
          },
        ],
        indices: [
          new TableIndex({
            name: 'IDX_AFIP_FILES_TYPE_ACTIVO',
            columnNames: ['file_type', 'activo'],
          }),
          new TableIndex({
            name: 'IDX_AFIP_FILES_CREATED_AT',
            columnNames: ['created_at'],
          }),
        ],
      }),
      true,
    );

    console.log('✅ Tabla afip_files creada correctamente');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertir: eliminar la tabla
    await queryRunner.dropTable('afip_files', true);
    console.log('⏮️ Tabla afip_files eliminada');
  }
}
