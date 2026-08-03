/**
 * Reset de datos para pasar a producción real.
 *
 * Deja la base en un estado "recién instalado":
 * - Conserva únicamente el usuario admin id_usuario=1 (superusuario del desarrollador)
 * - Conserva la tabla mayoristas (los 5 registros genéricos, sin tocar)
 * - Recrea los 4 usuarios mayoristas (rol 2) con los mismos placeholders del seed original
 * - Borra distribuidores, facturación, técnicos, descargas, compras prepago, certificados,
 *   auditoría y notificaciones
 * - Conserva certificados_maestro, afip_files y app_settings (config/certificado AFIP vigente)
 *
 * Uso (desde backend/):
 *   npx ts-node -r tsconfig-paths/register scripts/reset-produccion.ts --confirm
 *
 * Sin --confirm el script no ejecuta nada (dry-run: solo muestra lo que haría).
 */

import * as bcrypt from 'bcrypt';
import AppDataSource from '../src/data-source';

const CONFIRM_FLAG = '--confirm';

async function main() {
  const confirmado = process.argv.includes(CONFIRM_FLAG);

  console.log('======================================');
  console.log('Reset de datos — paso a producción');
  console.log('======================================');
  console.log(`Host: ${process.env.DB_HOST || 'localhost'} / DB: ${process.env.DB_NAME || 'db_sersa'}`);
  console.log(confirmado ? 'Modo: EJECUCIÓN REAL (--confirm presente)' : 'Modo: DRY-RUN (no se modifica nada, falta --confirm)');
  console.log('======================================\n');

  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    const contar = async (tabla: string): Promise<number> => {
      const [{ count }] = await queryRunner.query(`SELECT COUNT(*)::int AS count FROM ${tabla};`);
      return count;
    };

    const antes = {
      notificaciones: await contar('notificaciones'),
      auditoria: await contar('auditoria'),
      descargas: await contar('descargas'),
      compras_prepago: await contar('compras_prepago'),
      certificados_v2: await contar('certificados_v2'),
      users: await contar('users'),
    };

    console.log('Filas actuales:', antes);

    if (!confirmado) {
      console.log('\nDry-run finalizado. Volvé a correr con --confirm para aplicar los cambios.');
      await queryRunner.release();
      await AppDataSource.destroy();
      return;
    }

    await queryRunner.startTransaction();

    await queryRunner.query('DELETE FROM notificaciones;');
    await queryRunner.query('DELETE FROM auditoria;');
    await queryRunner.query('DELETE FROM descargas;');
    await queryRunner.query('DELETE FROM compras_prepago;');
    await queryRunner.query('DELETE FROM certificados_v2;');
    await queryRunner.query('DELETE FROM users WHERE id_usuario <> 1;');

    await queryRunner.query(`SELECT setval('compras_prepago_id_seq', 1, false);`);
    await queryRunner.query(`SELECT setval('users_id_usuario_seq', 1, true);`);

    const defaultPassword = process.env.DEFAULT_USER_PASSWORD || 'certificados';
    const hashedPassword = await bcrypt.hash(defaultPassword, 12);

    await queryRunner.query(
      `
      INSERT INTO users (nombre, cuit, mail, password, id_rol, id_mayorista, status, must_change_password, created_by, limite_descargas, tipo_descarga, notification_limit)
      VALUES
        ('OLICART',    '30000000002', 'mayorista.olicart@sersa.local',    $1, 2, 2, 1, true, 1, 5, 'CUENTA_CORRIENTE', 100),
        ('MARINUCCI',  '30000000003', 'mayorista.marinucci@sersa.local',  $1, 2, 3, 1, true, 1, 5, 'CUENTA_CORRIENTE', 100),
        ('COLOMA',     '30000000004', 'mayorista.coloma@sersa.local',     $1, 2, 4, 1, true, 1, 5, 'CUENTA_CORRIENTE', 100),
        ('SANTICH',    '30000000005', 'mayorista.santich@sersa.local',    $1, 2, 5, 1, true, 1, 5, 'CUENTA_CORRIENTE', 100)
      ON CONFLICT (cuit) DO NOTHING;
      `,
      [hashedPassword],
    );

    await queryRunner.query(`SELECT setval('users_id_usuario_seq', (SELECT MAX(id_usuario) FROM users));`);

    await queryRunner.commitTransaction();

    const despues = {
      notificaciones: await contar('notificaciones'),
      auditoria: await contar('auditoria'),
      descargas: await contar('descargas'),
      compras_prepago: await contar('compras_prepago'),
      certificados_v2: await contar('certificados_v2'),
      users: await contar('users'),
    };

    console.log('\nReset completado. Filas después:', despues);
  } catch (error) {
    console.error('\nError durante el reset, se revierte la transacción:', error);
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction();
    }
    process.exitCode = 1;
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

main();
