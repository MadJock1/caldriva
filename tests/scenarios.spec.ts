import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { simulationFixture } from "./fixtures";
import { openConfiguredStudio } from "./studio-helpers";

test("anonymous scenarios save, reopen and compare financial alternatives", async ({ page }) => {
  await page.route("**/api/solar", route => route.fulfill({ json: simulationFixture.result }));
  await openConfiguredStudio(page);
  await page.getByRole("button", { name: "Estimate with PVGIS" }).click();
  await expect(page.getByText("6,000 kWh", { exact: true })).toBeVisible();
  await page.getByLabel("Scenario name", { exact: true }).fill("Baseline");
  await page.getByRole("button", { name: "Save scenario locally" }).click();
  await expect(page.getByRole("button", { name: "Reopen Baseline", exact: true })).toBeVisible();
  
  // Navigate to finance step for Installed cost input
  await page.getByRole("button", { name: "Adjust financials" }).click();
  await expect(page.getByLabel("Installed cost (€)", { exact: true })).toBeVisible();
  await page.getByLabel("Installed cost (€)", { exact: true }).fill("8000");
  await page.getByLabel("Scenario name", { exact: true }).fill("Higher capital cost");
  await page.getByRole("button", { name: "Save scenario locally" }).click();
  await page.getByRole("checkbox", { name: "Baseline", exact: true }).check();
  await page.getByRole("checkbox", { name: "Higher capital cost", exact: true }).check();
  const comparison = page.getByRole("region", { name: "Scenario comparison table" });
  await expect(comparison).toBeVisible();
  await expect(comparison.getByRole("row", { name: /Installed cost/ })).toContainText("6,500");
  await expect(comparison.getByRole("row", { name: /Installed cost/ })).toContainText("8,000");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.reload();
  await page.getByRole("button", { name: "Load local scenarios" }).click();
  await page.getByRole("button", { name: "Reopen Baseline", exact: true }).click();
  // Navigate to finance step to check Installed cost
  await page.getByRole("button", { name: "3. Configure Solar", exact: true }).click();
  await page.getByRole("button", { name: "Financial assumptions", exact: true }).click();
  await expect(page.getByLabel("Installed cost (€)", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Installed cost (€)", { exact: true })).toHaveValue("6500");
  // Navigate back to results to check production
  await page.getByRole("button", { name: "4. Review Results", exact: true }).click();
  await expect(page.getByText("6,000 kWh", { exact: true })).toBeVisible();
  // Go back to System step to modify Panel count
  await page.getByRole("button", { name: "3. Configure Solar", exact: true }).click();
  await page.getByLabel("Panel count", { exact: true }).fill("11");
  await expect(page.getByRole("button", { name: "Save scenario locally" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Download preliminary PDF" })).toHaveCount(0);
});

test("reopened roof snapshot renders a layout and downloads a real PDF", async ({ page }) => {
  await page.addInitScript(snapshot => localStorage.setItem("caldriva-solar-scenarios-v1", JSON.stringify([{ id: "11111111-1111-4111-8111-111111111111", snapshot }])), simulationFixture);
  await page.goto("/tools/solar?step=system");
  await page.getByRole("button", { name: "Load local scenarios" }).click();
  await page.getByRole("button", { name: "Reopen Test scenario", exact: true }).click();
  await expect(page.getByRole("img", { name: /Preliminary horizontal roof layout with/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Use layout panel count" })).toBeEnabled();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download preliminary PDF" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("preliminary-solar-report.pdf");
  const path = await file.path();
  expect(path).toBeTruthy();
  const pdf = await PDFDocument.load(await readFile(path!));
  expect(pdf.getSubject()).toContain("not engineer-reviewed, certified or approved");
  expect(pdf.getPageCount()).toBeGreaterThanOrEqual(3);
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(8, 11, 17)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test("report API rejects inconsistent snapshots and oversized requests", async ({ request }) => {
  const invalid = await request.post("/api/reports/solar", { data: { ...simulationFixture, result: { ...simulationFixture.result, annualKwh: 8000 } } });
  expect(invalid.status()).toBe(400);
  const oversized = await request.post("/api/reports/solar", { headers: { "Content-Type": "application/json" }, data: "x".repeat(100001) });
  expect(oversized.status()).toBe(413);
});

test("unconfigured callback and simulation routes fail closed without external redirects", async ({ request, page }) => {
  test.skip(!!process.env.NEXT_PUBLIC_SUPABASE_URL, "Unconfigured installation boundary.");
  const callback = await request.get("/auth/callback?code=invalid&next=https://example.org", { maxRedirects: 0 });
  expect(callback.status()).toBe(400);
  expect(callback.headers()["location"]).toBeUndefined();
  expect(callback.headers()["cache-control"]).toContain("no-store");
  await page.goto("/dashboard/simulations");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/tools/solar?simulation=11111111-1111-4111-8111-111111111111");
  await expect(page.getByRole("heading", { name: "Saved scenario unavailable" })).toBeVisible();
});
