import { test, expect } from "@playwright/test";

test.describe("Auth flow", () => {
  test("login page renders core fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/e-?mail/i)).toBeVisible();
    await expect(page.getByLabel(/senha/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /entrar/i })).toBeVisible();
    await expect(page.getByText(/lembrar-me/i)).toBeVisible();
    await expect(page.getByText(/esqueceu a senha/i)).toBeVisible();
  });

  test("invalid credentials show error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/e-?mail/i).fill("naoexiste@teste.com");
    await page.getByLabel(/senha/i).first().fill("errada123");
    await page.getByRole("button", { name: /entrar/i }).click();
    // Aguarda mensagem de erro (toast ou inline)
    await expect(
      page.getByText(/inválid|incorret|erro|credenciais/i).first()
    ).toBeVisible({ timeout: 8000 });
  });

  test("protected route redirects to login with next param", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("next=");
    expect(decodeURIComponent(page.url())).toContain("/dashboard");
  });

  test("empty form shows validation", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /entrar/i }).click();
    await expect(
      page.getByText(/obrigat|preencha|inform/i).first()
    ).toBeVisible({ timeout: 5000 });
  });
});
