import { test, expect } from "@playwright/test";

test("brand logo appears in the site chrome, studio and auth screens", async ({ page }) => {
  await page.goto("/");
  const headerLogo = page.locator('header a[aria-label="CALDRIVA home"]');
  await expect(headerLogo).toBeVisible();
  await expect(headerLogo.locator("svg")).toBeVisible();
  await expect(headerLogo.getByText("CALDRIVA")).toBeVisible();
  await expect(page.locator('footer a[aria-label="CALDRIVA home"] svg')).toBeVisible();

  await page.goto("/tools/solar");
  await expect(page.getByText("Building Studio / Solar PV")).toBeVisible();
  await expect(page.locator("main").getByText("CALDRIVA").first()).toBeVisible();

  await page.goto("/login");
  await expect(page.locator("main").getByText("CALDRIVA").first()).toBeVisible();
  await expect(page.locator("main").getByText("Engineering & Technology").first()).toBeVisible();
});

test("declares and serves the brand icon and asset files", async ({ page, request }) => {
  await page.goto("/");
  const hrefs = await page
    .locator('head link[rel="icon"], head link[rel="apple-touch-icon"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute("href")).filter((href): href is string => Boolean(href)));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    const response = await request.get(href);
    expect(response.status(), href).toBe(200);
    expect(response.headers()["content-type"], href).toContain("image/");
  }

  for (const asset of [
    "/brand/caldriva-symbol.svg",
    "/brand/caldriva-symbol-white.svg",
    "/brand/caldriva-logo-horizontal.svg",
    "/brand/caldriva-logo-stacked.svg",
  ]) {
    const response = await request.get(asset);
    expect(response.status(), asset).toBe(200);
    expect(response.headers()["content-type"], asset).toContain("image/svg+xml");
  }
});
