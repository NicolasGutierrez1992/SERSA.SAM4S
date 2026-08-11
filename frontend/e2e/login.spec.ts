import { test, expect } from '@playwright/test';
import { E2E_ADMIN_CUIT, E2E_ADMIN_PASSWORD, skipIfNoAdminCreds } from './helpers';

test.describe('Login', () => {
  test('credenciales inválidas muestran un error y no redirigen', async ({ page }) => {
    await page.goto('/login');

    await page.fill('#cuit', '00000000000');
    await page.fill('#password', 'password-que-no-existe');
    await page.click('button[type="submit"]');

    await expect(page.getByText(/credenciales inválidas/i)).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('login exitoso redirige fuera de /login', async ({ page }) => {
    skipIfNoAdminCreds();

    await page.goto('/login');
    await page.fill('#cuit', E2E_ADMIN_CUIT!);
    await page.fill('#password', E2E_ADMIN_PASSWORD!);
    await page.click('button[type="submit"]');

    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
  });
});
