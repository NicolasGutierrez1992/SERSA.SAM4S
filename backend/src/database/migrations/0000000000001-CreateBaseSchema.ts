import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBaseSchema0000000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // gen_random_uuid() es built-in desde PostgreSQL 13 — no requiere extensión

    // Tipos ENUM que TypeORM usa para tipo_descarga
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE users_tipo_descarga_enum AS ENUM('CUENTA_CORRIENTE', 'PREPAGO');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE descargas_tipo_descarga_enum AS ENUM('CUENTA_CORRIENTE', 'PREPAGO');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS mayoristas (
        id_mayorista SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL
      );
    `);

    // users se crea SIN notification_limit — lo agrega migration 1734278400000
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id_usuario SERIAL PRIMARY KEY,
        status INTEGER,
        id_rol INTEGER,
        nombre TEXT,
        mail TEXT,
        password TEXT,
        must_change_password BOOLEAN NOT NULL DEFAULT false,
        id_mayorista INTEGER,
        cuit TEXT,
        limite_descargas INTEGER NOT NULL DEFAULT 5,
        created_by INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        ultimo_login TIMESTAMP,
        celular TEXT,
        tipo_descarga users_tipo_descarga_enum NOT NULL DEFAULT 'CUENTA_CORRIENTE'
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS certificados_v2 (
        id_certificado VARCHAR(50) PRIMARY KEY,
        fabricante VARCHAR(10) NOT NULL DEFAULT 'SE',
        marca VARCHAR(10) NOT NULL,
        modelo VARCHAR(10) NOT NULL,
        numero_serie VARCHAR(20) NOT NULL,
        metadata JSONB,
        archivo_referencia TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    // pfx_data se crea como BYTEA — migration 1748000001000 lo convierte a TEXT
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS certificados_maestro (
        id VARCHAR(50) PRIMARY KEY,
        pfx_data BYTEA NOT NULL,
        password_encriptada TEXT NOT NULL,
        metadata JSONB,
        certificado_identificador VARCHAR(50),
        activo BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        uploaded_at TIMESTAMP
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS descargas (
        id_descarga UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        id_usuario INTEGER NOT NULL,
        id_certificado VARCHAR(50),
        "estadoMayorista" TEXT NOT NULL DEFAULT 'Pendiente de Facturar',
        fecha_facturacion TIMESTAMP NOT NULL DEFAULT now(),
        "estadoDistribuidor" TEXT NOT NULL DEFAULT 'Pendiente de Facturar',
        "tamaño" BIGINT,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        certificado_nombre VARCHAR(255),
        tipo_descarga descargas_tipo_descarga_enum,
        numero_factura VARCHAR(255),
        referencia_pago VARCHAR(255),
        CONSTRAINT fk_descargas_usuario FOREIGN KEY (id_usuario) REFERENCES users(id_usuario)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS auditoria (
        id_auditoria UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_id INTEGER,
        accion TEXT NOT NULL,
        objetivo_tipo TEXT NOT NULL,
        objetivo_id TEXT,
        antes JSONB,
        despues JSONB,
        ip TEXT,
        "timestamp" TIMESTAMP DEFAULT now(),
        CONSTRAINT fk_auditoria_actor FOREIGN KEY (actor_id) REFERENCES users(id_usuario)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notificaciones (
        id_notificacion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tipo TEXT NOT NULL,
        destinatario_id INTEGER,
        estado_envio TEXT NOT NULL DEFAULT 'Pendiente',
        fecha TIMESTAMP NOT NULL DEFAULT now(),
        payload JSONB,
        CONSTRAINT fk_notificaciones_destinatario FOREIGN KEY (destinatario_id) REFERENCES users(id_usuario)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notificaciones;`);
    await queryRunner.query(`DROP TABLE IF EXISTS auditoria;`);
    await queryRunner.query(`DROP TABLE IF EXISTS descargas;`);
    await queryRunner.query(`DROP TABLE IF EXISTS certificados_maestro;`);
    await queryRunner.query(`DROP TABLE IF EXISTS certificados_v2;`);
    await queryRunner.query(`DROP TABLE IF EXISTS users;`);
    await queryRunner.query(`DROP TABLE IF EXISTS mayoristas;`);
    await queryRunner.query(`DROP TYPE IF EXISTS descargas_tipo_descarga_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS users_tipo_descarga_enum;`);
  }
}
