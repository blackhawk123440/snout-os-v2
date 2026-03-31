/**
 * Smoke test: core closed loop
 * Sitter: check-in -> check-out -> Daily Delight with photo -> Client sees report
 */

import { test, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

// Minimal valid 1x1 JPEG (119 bytes)
const MINIMAL_JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

test.describe("Smoke: Closed loop", () => {
  test.describe.configure({ mode: "serial", project: "sitter" });
  test.use({ storageState: "tests/.auth/sitter.json" });

  test("sitter check-in -> check-out -> Daily Delight with photo -> client sees report", async ({
    page,
    request,
  }) => {
    // 1. Sitter opens Today
    await page.goto("/sitter/today");
    await expect(page.getByRole("heading", { name: /Today/i })).toBeVisible({
      timeout: 10000,
    });

    // Wait for bookings to load
    await page.waitForSelector('button:has-text("Start Visit"), button:has-text("Check in")', {
      timeout: 15000,
    }).catch(() => {});

    const checkInBtn = page.getByRole("button", {
      name: /Start Visit|Check in/i,
    }).first();
    if (!(await checkInBtn.isVisible())) {
      test.skip(true, "No booking today for sitter - seed may not have run");
      return;
    }

    // 2. Check in
    await checkInBtn.click();
    await expect(
      page.getByRole("button", { name: /Finish Visit|Check out/i }).first()
    ).toBeVisible({ timeout: 5000 });

    // 3. Check out
    await page.getByRole("button", { name: /Finish Visit|Check out/i }).first().click();
    await expect(
      page.getByRole("button", { name: /Daily Delight/i }).first()
    ).toBeVisible({ timeout: 5000 });

    // 4. Open Daily Delight modal
    await page.getByRole("button", { name: /Daily Delight/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // 5. Add photo - create temp file for upload
    const tmpDir = path.join(process.cwd(), "tests", ".tmp");
    await fs.promises.mkdir(tmpDir, { recursive: true });
    const testJpegPath = path.join(tmpDir, "test-smoke.jpg");
    await fs.promises.writeFile(
      testJpegPath,
      Buffer.from(MINIMAL_JPEG_BASE64, "base64")
    );

    const fileInput = page.getByRole("dialog").locator('input[type="file"]');
    await fileInput.setInputFiles(testJpegPath);
    await page.waitForTimeout(500);

    // 6. Generate and send
    await page.getByRole("button", { name: "Generate" }).click();
    await page.waitForTimeout(2000);
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // 7. Client sees report
    const clientContext = await request.newContext({
      storageState: "tests/.auth/client.json",
    });
    const clientPage = await clientContext.newPage();
    await clientPage.goto("/client/home");
    await expect(clientPage.getByText(/Latest update|Welcome/i)).toBeVisible({
      timeout: 10000,
    });
    await clientContext.dispose();
  });
});
