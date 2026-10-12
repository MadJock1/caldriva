import { test, expect, type Locator, type Page } from "@playwright/test";

// Real end-to-end coverage for Partial Prerendering (PPR).
//
// Each PPR route wraps its dynamic content in a <Suspense> boundary, so the
// server serves a static shell (header, footer, <main> and the Suspense fallback)
// and streams the resolved content afterwards. These tests assert that contract
// for real:
//   1. the served shell carries the prerendered chrome and the fallback;
//   2. with JavaScript off the fallback is what renders (the pre-hydration shell);
//   3. once hydrated the fallback is replaced and the studio exists exactly once.
//
// The third test is the regression guard for the previous PPR/hydration
// flake: the server keeps a *hidden* duplicate of streamed content in the DOM,
// so uniqueness must be asserted on visible elements only (text locators match
// hidden nodes, which is what made unscoped locators resolve to 2 elements).

type PprPage = {
  path: string;
  fallback: string;
  /** The interactive control that only exists once the dynamic studio streams in. */
  ready: (page: Page) => Locator;
  /** A studio element that must resolve to exactly one *visible* node after hydration. */
  unique: (page: Page) => Locator;
};

const PPR_PAGES: PprPage[] = [
  {
    path: "/tools/solar",
    fallback: "Loading Building Studio",
    ready: page => page.getByRole("button", { name: "1. Find Building" }),
    unique: page => page.getByText("Building Studio / Solar PV").filter({ visible: true }),
  },
  {
    path: "/tools/electrical",
    fallback: "Loading Auto Electrical Design Studio",
    ready: page => page.getByRole("button", { name: "Generate building" }),
    unique: page => page.getByRole("button", { name: "Generate building" }).filter({ visible: true }),
  },
];

for (const ppr of PPR_PAGES) {
  test(`${ppr.path} PPR shell carries the prerendered chrome and the Suspense fallback`, async ({ request }) => {
    const response = await request.get(ppr.path);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain('aria-label="CALDRIVA home"');
    expect(html).toContain(ppr.fallback);
    expect(html).toContain("__next_f");
  });

  test(`${ppr.path} PPR serves the Suspense fallback before hydration (no JavaScript)`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    try {
      await page.goto(ppr.path);
      await expect(page.locator('main [role="status"]').filter({ visible: true }).first()).toContainText(ppr.fallback);
      await expect(ppr.ready(page).filter({ visible: true })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test(`${ppr.path} PPR hydrates to a single visible studio instance with no duplicate elements`, async ({ page }) => {
    await page.goto(ppr.path);
    await expect(ppr.ready(page).first()).toBeVisible();
    await expect(ppr.unique(page)).toHaveCount(1);
    await expect(page.getByText(ppr.fallback).filter({ visible: true })).toHaveCount(0);
    await expect(page.locator("main#main")).toHaveCount(1);
    await expect(page.locator('header a[aria-label="CALDRIVA home"]')).toHaveCount(1);
    await expect(page.locator('footer a[aria-label="CALDRIVA home"]')).toHaveCount(1);
  });
}
