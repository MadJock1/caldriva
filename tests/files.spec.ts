import { test, expect } from "@playwright/test";

test("building files workspace redirects anonymous visitors to sign in", async ({ page }) => {
  await page.goto("/dashboard/buildings/11111111-1111-4111-8111-111111111111/files");
  await expect(page).toHaveURL(/\/login$/);
});
