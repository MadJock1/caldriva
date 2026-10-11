import { test, expect } from "@playwright/test";

test("manual position requires confirmation and survives reopening", async ({ page }) => {
  await page.goto("/tools/solar");
  await expect(page.getByRole("button", { name: "Confirm Building", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "2. Define Roof" })).toBeDisabled();
  await page.locator(".leaflet-container").click({ position: { x: 180, y: 160 } });
  await expect(page.getByText("Location selected manually", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirm Building", exact: true }).click();
  await page.getByRole("button", { name: "Draw roof", exact: true }).first().click();
  for (const [x, y] of [[160, 120], [240, 120], [240, 220], [160, 220]]) await page.locator(".leaflet-container").click({ position: { x, y } });
  await expect(page.getByRole("button", { name: "Continue to system" })).toBeEnabled();
  await page.getByRole("button", { name: "1. Find Building" }).click();
  await expect(page.getByText("Location selected manually", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save local draft" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Reopen draft", exact: true }).click();
  await expect(page.getByRole("button", { name: "2. Define Roof" })).toBeEnabled();
});

test("address lookup selection is not automatic confirmation", async ({ page }) => {
  await page.route("**/api/geocoding/autocomplete?**", route => route.fulfill({ json: { results: [{ formattedAddress: "Faro — test fixture", latitude: 37.0194, longitude: -7.9304, provider: "geoapify", resultType: "building" }] } }));
  await page.goto("/tools/solar");
  const input = page.getByRole("combobox", { name: "Search address" });
  await input.fill("Faro");
  await expect(page.getByRole("option")).toBeVisible();
  await input.press("ArrowDown"); await input.press("Enter");
  await expect(page.getByRole("button", { name: "2. Define Roof" })).toBeDisabled();
  await expect(page.getByText("37.019400, -7.930400")).toBeVisible();
  await page.getByRole("button", { name: "Confirm Building", exact: true }).click();
  await expect(page.getByRole("button", { name: "2. Define Roof" })).toBeEnabled();
});

test("dark theme pages avoid light card surfaces", async ({ page }) => {
  for (const path of ["/", "/services", "/tools", "/services/solar", "/login", "/register"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const offenders = await page.evaluate(() => {
      const found: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
        const rect = el.getBoundingClientRect();
        if (rect.width < 8 || rect.height < 8) continue;
        const bg = getComputedStyle(el).backgroundColor;
        const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!m) continue;
        const a = m[4] === undefined ? 1 : Number(m[4]);
        if (a > 0.5 && Number(m[1]) >= 240 && Number(m[2]) >= 240 && Number(m[3]) >= 240) {
          found.push(`${el.tagName.toLowerCase()}.${el.className} => ${bg}`);
        }
      }
      return found;
    });
    expect(offenders, `${path} renders light card backgrounds in dark mode`).toEqual([]);
  }
});

test("workspace screenshots and theme surfaces", async ({ page }, testInfo) => {
  for (const [width, height] of [[1440,900], [1366,768], [1024,768], [390,844], [360,800]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/tools/solar");
    await expect(page.locator(".leaflet-container")).toBeVisible();
    for (const theme of ["dark", "light"]) {
      if (theme === "light") await page.getByRole("button", { name: "Toggle light or dark theme" }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
      const box = await page.locator(".leaflet-container").boundingBox();
      expect(box!.y).toBeLessThan(height - 180);
      expect(await page.locator(".studio-controls aside").evaluate(el => getComputedStyle(el).backgroundColor)).toBe(theme === "dark" ? "rgb(18, 25, 36)" : "rgb(255, 255, 255)");
      await page.screenshot({ path: testInfo.outputPath(`${width}-${theme}.png`), fullPage: true });
    }
  }
});
