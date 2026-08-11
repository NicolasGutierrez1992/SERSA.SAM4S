import { test } from '@playwright/test';

/**
 * Credenciales de prueba, nunca hardcodeadas: se leen de variables de entorno
 * (en CI, ci.yml siembra un usuario admin efímero en la base descartable del
 * job — ver el paso "Sembrar usuario admin de prueba"). Si no están seteadas
 * (ej. corriendo `npm run test:e2e` en una máquina sin configurar), el test
 * que las necesita se saltea con un mensaje claro en vez de fallar confuso.
 */
export const E2E_ADMIN_CUIT = process.env.E2E_ADMIN_CUIT;
export const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
export const E2E_DISTRIBUIDOR_CUIT = process.env.E2E_DISTRIBUIDOR_CUIT;
export const E2E_DISTRIBUIDOR_PASSWORD = process.env.E2E_DISTRIBUIDOR_PASSWORD;

export function skipIfNoAdminCreds() {
  test.skip(
    !E2E_ADMIN_CUIT || !E2E_ADMIN_PASSWORD,
    'Requiere E2E_ADMIN_CUIT/E2E_ADMIN_PASSWORD en el entorno (seteadas automáticamente en CI)',
  );
}

export function skipIfNoDistribuidorCreds() {
  test.skip(
    !E2E_DISTRIBUIDOR_CUIT || !E2E_DISTRIBUIDOR_PASSWORD,
    'Requiere E2E_DISTRIBUIDOR_CUIT/E2E_DISTRIBUIDOR_PASSWORD en el entorno (seteadas automáticamente en CI)',
  );
}
