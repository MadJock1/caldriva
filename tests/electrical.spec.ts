import { test, expect } from "@playwright/test";

test("electrical tool replaces the planned-module placeholder", async ({ page }) => {
  await page.goto("/tools/electrical");
  await expect(page.getByText(/Auto Electrical Design Studio/i).first()).toBeVisible();
  await expect(page.getByText("Planned module")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Generate building" })).toBeVisible();
});

test("generates a building and reviews the preliminary electrical outputs", async ({ page }) => {
  await page.goto("/tools/electrical");
  await page.getByLabel("Building name").fill("E2E Tower");
  await page.getByRole("button", { name: "Generate building" }).click();

  await expect(page.getByRole("button", { name: "2. Building" })).toBeVisible();
  await expect(page.getByText(/Ground floor/).first()).toBeVisible();

  await page.getByRole("button", { name: "5. Loads" }).click();
  await expect(page.getByText("Phase balance (estimated demand, VA)")).toBeVisible();
  await expect(page.getByText("Design demand").first()).toBeVisible();

  await page.getByRole("button", { name: "6. Distribution" }).click();
  await expect(page.getByLabel("Single-line distribution diagram")).toBeVisible();
  await expect(page.getByLabel("Riser diagram")).toBeVisible();
  await expect(page.getByText("Board schedule")).toBeVisible();

  await page.getByRole("button", { name: "7. Review" }).click();
  await expect(page.getByText("Wiring-regulation review")).toBeVisible();
  await expect(page.getByText(/not certify compliance/i).first()).toBeVisible();
});

test("auto-arranges floor-plan rooms and proposes electrical points", async ({ page }) => {
  await page.goto("/tools/electrical");
  await page.getByLabel("Building name").fill("Plan Auto");
  await page.getByRole("button", { name: "Generate building" }).click();
  await page.getByRole("button", { name: "3. Plan" }).click();

  await expect(page.getByLabel("Floor plan editor")).toBeVisible();
  await page.getByRole("button", { name: /Auto-arrange/ }).click();

  await expect(page.locator('svg[aria-label^="Floor plan"] text', { hasText: "Living room" }).first()).toBeVisible();
  await expect(page.locator('svg[aria-label^="Floor plan"] circle').first()).toBeVisible();
  await expect(page.getByText("Points on this floor")).toBeVisible();

  await page.getByRole("button", { name: "Sync loads from plan" }).click();
  await page.getByRole("button", { name: "Auto-route points" }).click();

  await page.getByRole("button", { name: "6. Distribution" }).click();
  await expect(page.getByText("Point schedule")).toBeVisible();
  await expect(page.getByText(/LGT-|SOC-/).first()).toBeVisible();
  await expect(page.getByText("Route lengths & voltage drop")).toBeVisible();
  await expect(page.getByText(/Worst case/)).toBeVisible();

  await page.getByRole("button", { name: "5. Loads" }).click();
  await expect(page.getByText("Phase balance (estimated demand, VA)")).toBeVisible();
});

test("draws a room, generates points and keeps the local draft", async ({ page }) => {
  await page.goto("/tools/electrical");
  await page.getByLabel("Building name").fill("Plan Draw");
  await page.getByRole("button", { name: "Generate building" }).click();
  await page.getByRole("button", { name: "3. Plan" }).click();

  await page.getByRole("button", { name: "Draw room" }).click();
  const svg = page.locator('svg[aria-label^="Floor plan"]');
  await svg.scrollIntoViewIfNeeded();
  const box = await svg.boundingBox();
  if (!box) throw new Error("plan svg has no bounding box");
  await page.mouse.move(box.x + 30, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, box.y + 150, { steps: 6 });
  await page.mouse.up();

  await expect(page.getByText("Selected room", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Generate points" }).click();
  await expect(page.locator('svg[aria-label^="Floor plan"] circle').first()).toBeVisible();

  await page.getByRole("button", { name: "Save local draft" }).click();
  await expect(page.getByText(/saved on this browser only/i)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Reopen draft" }).click();
  await page.getByRole("button", { name: "3. Plan" }).click();
  await expect(page.locator('svg[aria-label^="Floor plan"] circle').first()).toBeVisible();
});

test("CAD edits undo atomically, constrain rooms and export drawings", async ({ page }) => {
  await page.goto("/tools/electrical");
  await page.getByRole("button", { name: "Generate building" }).click();
  await page.getByRole("button", { name: "3. Plan" }).click();
  await page.getByRole("button", { name: /Auto-arrange/ }).click();
  await page.getByLabel("Show electrical points", { exact: true }).uncheck();
  const rooms = page.locator("[data-room-id]");
  const count = await rooms.count();
  await rooms.first().click({ position: { x: 10, y: 10 } });
  await page.getByRole("button", { name: "Duplicate rooms" }).click();
  await expect(rooms).toHaveCount(count + 1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(rooms).toHaveCount(count);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(rooms).toHaveCount(count + 1);
  await rooms.first().click({ position: { x: 5, y: 5 } });
  await page.getByLabel("Room w", { exact: true }).fill("5");
  await page.getByLabel("Lock room dimensions").check();
  await expect(page.getByLabel("Room w", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Add door", exact: true }).click();
  await page.getByLabel("Opening 1 edge").selectOption("right");
  await page.getByLabel("Wall thickness", { exact: true }).fill("0.2");
  for (const format of ["SVG", "PNG", "DXF geometry"]) {
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: `Export ${format}`, exact: true }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toMatch(/\.(svg|png|dxf)$/);
    expect(await download.failure()).toBeNull();
  }
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.locator('svg[aria-label^="Floor plan"]')).not.toHaveAttribute("viewBox", "0 0 880 616");
  await page.getByRole("button", { name: "Fit plan", exact: true }).click();
  await page.getByRole("button", { name: "Save local draft" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Reopen draft" }).click();
  await page.getByRole("button", { name: "3. Plan" }).click();
  await page.getByLabel("Show electrical points", { exact: true }).uncheck();
  await rooms.first().click({ position: { x: 5, y: 5 } });
  await expect(page.getByLabel("Opening 1 edge")).toHaveValue("right");
  await expect(page.getByLabel("Room w", { exact: true })).toHaveValue("5");
});

test("CAD group moves at zoomed scale undo as one gesture", async ({ page }) => {
  await page.goto("/tools/electrical");
  await page.getByRole("button", { name: "Generate building" }).click();
  await page.getByRole("button", { name: "3. Plan" }).click();
  await page.getByRole("button", { name: /Auto-arrange/ }).click();
  await page.getByLabel("Show electrical points", { exact: true }).uncheck();
  const rooms = page.locator("[data-room-id]");
  await rooms.first().click({ position: { x: 5, y: 5 } });
  await page.getByLabel("Room w", { exact: true }).fill("4.2");
  await rooms.nth(1).click({ position: { x: 5, y: 5 }, modifiers: ["Shift"] });
  await expect(page.getByText(/2 rooms selected/)).toBeVisible();
  await page.getByRole("button", { name: "Equal width", exact: true }).click();
  await expect(rooms.first()).toHaveAttribute("width", "176");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(rooms.first()).toHaveAttribute("width", "184.8");
  await rooms.first().click({ position: { x: 5, y: 5 } });
  await rooms.nth(1).click({ position: { x: 5, y: 5 }, modifiers: ["Shift"] });
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await rooms.first().scrollIntoViewIfNeeded();
  const before = await rooms.first().getAttribute("x");
  const secondBefore = await rooms.nth(1).getAttribute("x");
  const box = (await rooms.first().boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 35, box.y + 20, { steps: 5 });
  await page.mouse.up();
  expect(await rooms.first().getAttribute("x")).not.toBe(before);
  const delta = Number(await rooms.first().getAttribute("x")) - Number(before);
  expect(Number(await rooms.nth(1).getAttribute("x")) - Number(secondBefore)).toBeCloseTo(delta);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(rooms.first()).toHaveAttribute("x", before!);
  await expect(rooms.nth(1)).toHaveAttribute("x", secondBefore!);
});

test("local draft round-trips through browser storage", async ({ page }) => {
  await page.goto("/tools/electrical");
  await page.getByLabel("Building name").fill("Draft persistence");
  await page.getByRole("button", { name: "Generate building" }).click();
  await page.getByRole("button", { name: "Save local draft" }).click();
  await expect(page.getByText(/saved on this browser only/i)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Reopen draft" }).click();
  await expect(page.getByText("Draft persistence").first()).toBeVisible();
});

test("dark theme electrical studio avoids light card surfaces", async ({ page }) => {
  await page.goto("/tools/electrical");
  await page.getByRole("button", { name: "Generate building" }).click();
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
  expect(offenders).toEqual([]);
});
