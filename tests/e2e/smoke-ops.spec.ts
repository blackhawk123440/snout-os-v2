/**
 * Smoke test: ops visibility
 * Owner opens /ops/automation-failures, /ops/message-failures, /ops/calendar-repair
 * Pages load (200) and render empty states if no failures.
 */

import { test, expect } from "@playwright/test";

test.describe("Smoke: Ops visibility", () => {
  test.describe.configure({ project: "owner" });
  test.use({ storageState: "tests/.auth/owner.json" });

  test("owner opens ops pages", async ({ page }) => {
    await page.goto("/ops/automation-failures");
    await expect(page).toHaveURL(/\/ops\/automation-failures/);
    await expect(page.getByRole("heading", { name: "Automation Failures" })).toBeVisible({
      timeout: 10000,
    });

    await page.goto("/ops/message-failures");
    await expect(page).toHaveURL(/\/ops\/message-failures/);
    await expect(page.getByRole("heading", { name: "Message Failures" })).toBeVisible({
      timeout: 10000,
    });

    await page.goto("/ops/calendar-repair");
    await expect(page).toHaveURL(/\/ops\/calendar-repair/);
    await expect(page.getByRole("heading", { name: "Calendar Repair" })).toBeVisible({
      timeout: 10000,
    });
  });
});
