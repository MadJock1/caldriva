import { test, expect } from "@playwright/test";

test("public request-quote page submits and falls back gracefully when accounts are unconfigured", async ({ page }) => {
  await page.goto("/request-quote");
  await page.getByLabel("Project name").fill("West roof PV");
  await page.getByLabel("Scope, location, available drawings and deliverables").fill("5 kWp rooftop PV, Lisbon.");
  await page.getByRole("button", { name: "Submit quotation request" }).click();
  const alert = page.locator('p[role="alert"]');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("Sign in");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download draft brief" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("engineering-brief.txt");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test("quotation workspaces redirect anonymous visitors to sign in", async ({ page }) => {
  await page.goto("/dashboard/quotes");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard/engineer");
  await expect(page).toHaveURL(/\/login$/);
});
