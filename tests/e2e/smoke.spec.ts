import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Snout/);
  });

  test("settings page loads and is accessible", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: /Settings/i })).toBeVisible();
  });

  test("bookings page loads", async ({ page }) => {
    await page.goto("/bookings");
    await expect(page.getByRole("heading", { name: /Bookings/i })).toBeVisible();
  });

  test("health endpoint responds", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty("status");
    expect(data).toHaveProperty("db");
    expect(data).toHaveProperty("redis");
    expect(data).toHaveProperty("version");
  });
});


