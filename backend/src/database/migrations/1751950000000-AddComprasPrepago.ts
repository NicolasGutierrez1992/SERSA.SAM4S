import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddComprasPrepago1751950000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS compras_prepago (
        id SERIAL PRIMARY KEY,
        id_usuario INTEGER NOT NULL REFERENCES users(id_usuario),
        numero_factura VARCHAR(255) NULL,
        cantidad INTEGER NOT NULL,
        cantidad_usada INTEGER NOT NULL DEFAULT 0,
        fecha_compra TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by INTEGER NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_compras_prepago_usuario_fecha ON compras_prepago (id_usuario, fecha_compra);

      ALTER TABLE descargas ADD COLUMN IF NOT EXISTS id_compra_prepago INTEGER NULL REFERENCES compras_prepago(id);
      CREATE INDEX IF NOT EXISTS idx_descargas_compra_prepago ON descargas (id_compra_prepago);
    `);

    // Migrar saldo existente: crear una compra inicial "Saldo migrado" (sin factura)
    // para cada usuario PREPAGO que ya tuviera límite de descargas cargado.
    await queryRunner.query(`
      INSERT INTO compras_prepago (id_usuario, numero_factura, cantidad, cantidad_usada, fecha_compra)
      SELECT id_usuario, NULL, limite_descargas, 0, NOW()
      FROM users
      WHERE tipo_descarga = 'PREPAGO' AND limite_descargas > 0;
    `);

    // limite_descargas pasa a significar exclusivamente el límite de cuenta corriente.
    // Resetear a 0 el de los usuarios recién migrados para no duplicar su crédito
    // (su saldo ya quedó preservado como compra prepago en el INSERT anterior).
    await queryRunner.query(`
      UPDATE users SET limite_descargas = 0 WHERE tipo_descarga = 'PREPAGO' AND limite_descargas > 0;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE descargas DROP COLUMN IF EXISTS id_compra_prepago;
      DROP TABLE IF EXISTS compras_prepago;
    `);
  }
}
