import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

export class SeedBaseData1748000002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- 1. Poblar tabla mayoristas con IDs fijos ---
    // El frontend hardcodea IDs 1-5 en usuarios/page.tsx y certificados/page.tsx
    await queryRunner.query(`
      INSERT INTO mayoristas (id_mayorista, nombre)
      OVERRIDING SYSTEM VALUE
      VALUES
        (1, 'SERSA'),
        (2, 'OLICART'),
        (3, 'MARINUCCI'),
        (4, 'COLOMA'),
        (5, 'SANTICH')
      ON CONFLICT DO NOTHING;
    `);
    await queryRunner.query(`SELECT setval('mayoristas_id_mayorista_seq', 5);`);

    // --- 2. Crear usuarios admin y mayoristas ---
    const defaultPassword = process.env.DEFAULT_USER_PASSWORD || 'certificados';
    const hashedPassword = await bcrypt.hash(defaultPassword, 12);

    // Admin principal
    await queryRunner.query(`
      INSERT INTO users (nombre, cuit, mail, celular, password, id_rol, id_mayorista, status, must_change_password, created_by, limite_descargas, tipo_descarga)
      VALUES ('Admin SERSA', '00000000000', 'nicolasgutierrez1049@gmail.com', '1169939949', $1, 1, 1, 1, true, 1, 0, 'PREPAGO')
      ON CONFLICT (cuit) DO NOTHING;
    `, [hashedPassword]);

    // Usuarios mayoristas
    await queryRunner.query(`
      INSERT INTO users (nombre, cuit, mail, password, id_rol, id_mayorista, status, must_change_password, created_by, limite_descargas, tipo_descarga, notification_limit)
      VALUES
        ('OLICART',    '30000000002', 'mayorista.olicart@sersa.local',    $1, 2, 2, 1, true, 1, 5, 'CUENTA_CORRIENTE', 100),
        ('MARINUCCI',  '30000000003', 'mayorista.marinucci@sersa.local',  $1, 2, 3, 1, true, 1, 5, 'CUENTA_CORRIENTE', 100),
        ('COLOMA',     '30000000004', 'mayorista.coloma@sersa.local',     $1, 2, 4, 1, true, 1, 5, 'CUENTA_CORRIENTE', 100),
        ('SANTICH',    '30000000005', 'mayorista.santich@sersa.local',    $1, 2, 5, 1, true, 1, 5, 'CUENTA_CORRIENTE', 100)
      ON CONFLICT (cuit) DO NOTHING;
    `, [hashedPassword]);

    // Avanzar secuencia al máximo actual
    await queryRunner.query(`SELECT setval('users_id_usuario_seq', (SELECT MAX(id_usuario) FROM users));`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM users WHERE cuit IN ('00000000000', '30000000002', '30000000003', '30000000004', '30000000005');
    `);
    await queryRunner.query(`
      DELETE FROM mayoristas WHERE id_mayorista IN (1, 2, 3, 4, 5);
    `);
  }
}
