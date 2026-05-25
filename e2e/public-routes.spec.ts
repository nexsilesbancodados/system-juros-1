import { test, expect } from "@playwright/test";

test.describe("Public routes", () => {
  test("landing page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/.+/);
  });

  test("plans page is public", async ({ page }) => {
    const res = await page.goto("/planos");
    expect(res?.status()).toBeLessThan(400);
  });

  test("reset-password page is public", async ({ page }) => {
    const res = await page.goto("/reset-password");
    expect(res?.status()).toBeLessThan(400);
  });

  test("client portal is public", async ({ page }) => {
    const res = await page.goto("/portal-cliente");
    expect(res?.status()).toBeLessThan(400);
  });
});
