import { test, expect } from '@playwright/test';
import {
  E2E_ADMIN_CUIT,
  E2E_ADMIN_PASSWORD,
  E2E_DISTRIBUIDOR_CUIT,
  E2E_DISTRIBUIDOR_PASSWORD,
  skipIfNoAdminCreds,
  skipIfNoDistribuidorCreds,
} from './helpers';

async function login(page: import('@playwright/test').Page, cuit: string, password: string) {
  await page.goto('/login');
  await page.fill('#cuit', cuit);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
}

test.describe('Auditoría — control de acceso', () => {
  test('Admin puede acceder a /dashboard/auditoria y ve el historial', async ({ page }) => {
    skipIfNoAdminCreds();

    await login(page, E2E_ADMIN_CUIT!, E2E_ADMIN_PASSWORD!);
    await page.goto('/dashboard/auditoria');

    await expect(page).toHaveURL(/\/dashboard\/auditoria/);
    await expect(page.getByRole('heading', { name: 'Auditoría' })).toBeVisible();
    await expect(page.getByText('Historial')).toBeVisible();
    await expect(page.getByText('Métricas')).toBeVisible();
  });

  test('un rol no-admin es redirigido fuera de /dashboard/auditoria', async ({ page }) => {
    skipIfNoDistribuidorCreds();

    await login(page, E2E_DISTRIBUIDOR_CUIT!, E2E_DISTRIBUIDOR_PASSWORD!);
    await page.goto('/dashboard/auditoria');

    await expect(page).not.toHaveURL(/\/dashboard\/auditoria/, { timeout: 10000 });
  });
});

test.describe('Auditoría — responsive en móvil', () => {
  // Viewport de celular dentro del mismo proyecto chromium (no usamos el
  // preset devices['iPhone 13'] porque fuerza el motor webkit, no configurado
  // en playwright.config.ts).
  test.use({ viewport: { width: 390, height: 844 } });

  test('en viewport móvil la tabla se reemplaza por tarjetas apiladas', async ({ page }) => {
    skipIfNoAdminCreds();

    await login(page, E2E_ADMIN_CUIT!, E2E_ADMIN_PASSWORD!);
    await page.goto('/dashboard/auditoria');
    await expect(page.getByRole('heading', { name: 'Auditoría' })).toBeVisible();

    // La tabla de Ant Design (desktop) debe estar oculta en este viewport…
    await expect(page.locator('.ant-table').first()).toBeHidden();

    // …y no debe haber scroll horizontal en el body (el objetivo del rediseño).
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
});
