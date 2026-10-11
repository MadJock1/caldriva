import { test, expect } from "@playwright/test";
import { openConfiguredStudio } from "./studio-helpers";

test("public navigation and mobile layout", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your building. Smarter engineering.");
  await page.getByRole("link", { name: "Explore Your Building" }).click();
  await expect(page.getByRole("heading", { name: "Explore your building." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test("local draft survives reload and can be reopened", async ({ page }) => {
  await page.goto("/tools/solar?step=system");
  await page.getByLabel("Project name", { exact: true }).fill("Browser test building");
  await page.getByRole("button", { name: "Save local draft" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Draft saved" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Reopen draft" }).click();
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue("Browser test building");
});

test("solar response, invalidation and upstream failure are explicit", async ({ page }) => {
  // Deterministic test fixture only; production always requests PVGIS.
  await page.route("**/api/solar", route => route.fulfill({ json: { annualKwh: 6000, capacityKwp: 4.3, specificYield: 6000 / 4.3, monthly: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, E_m: 500 })), database: "TEST FIXTURE", source: "Test PVGIS fixture", engineVersion: "test", calculatedAt: "2026-01-01T00:00:00Z" } }));
  await openConfiguredStudio(page);
  await page.getByRole("button", { name: "Estimate with PVGIS" }).click();
  await expect(page.getByText("6,000 kWh", { exact: true })).toBeVisible();
  // After estimate, step changes to Results. Go back to System to modify Panel count.
  await page.getByRole("button", { name: "3. Configure Solar", exact: true }).click();
  await page.getByLabel("Panel count", { exact: true }).fill("11");
  // Go back to Results to see "System inputs changed."
  await page.getByRole("button", { name: "4. Review Results", exact: true }).click();
  await expect(page.getByText("System inputs changed.", { exact: false })).toBeVisible();
  await page.route("**/api/solar", route => route.fulfill({ status: 502, json: { error: "PVGIS unavailable for this test" } }));
  // Go back to System step to click Estimate with PVGIS again
  await page.getByRole("button", { name: "3. Configure Solar", exact: true }).click();
  await page.getByRole("button", { name: "Estimate with PVGIS" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "PVGIS unavailable for this test" })).toBeVisible();
  await expect(page.getByText("6,000 kWh", { exact: true })).toHaveCount(0);
});

test("API rejects malformed inputs before contacting PVGIS", async ({ request }) => {
  const response = await request.post("/api/solar", { data: { latitude: 100 } });
  expect(response.status()).toBe(400);
});

test("unconfigured account access fails closed while local studio stays usable", async ({ page }) => {
  test.skip(!!process.env.NEXT_PUBLIC_SUPABASE_URL, "This boundary test targets installations without Supabase configuration.");
  await page.goto("/dashboard/buildings");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Account access is not configured", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await page.goto("/tools/solar?step=system");
  await page.getByText("Save & account", { exact: false }).click();
  await page.getByRole("button", { name: "Save to account", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Sign in to save to your account" })).toBeVisible();
  await expect(page.getByLabel("Project name", { exact: true })).toBeEnabled();
  await page.goto("/tools/solar?building=11111111-1111-4111-8111-111111111111");
  await expect(page.getByRole("heading", { name: "Cloud building unavailable" })).toBeVisible();
});

test("background uses new dark theme color", async ({ page }) => {
  await page.goto("/");
  const bgColor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bgColor).toBe("rgb(8, 11, 17)");
});
