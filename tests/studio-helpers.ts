import { type Page } from "@playwright/test";
import { simulationFixture } from "./fixtures";
export async function openConfiguredStudio(page: Page) {
  await page.addInitScript(draft => localStorage.setItem("caldriva-building-v1", JSON.stringify(draft)), { ...simulationFixture.building, locationSource: "manual", locationConfirmed: true });
  await page.goto("/tools/solar");
  await page.getByRole("button", { name: "Reopen draft", exact: true }).click();
  await page.getByRole("button", { name: "3. Configure Solar", exact: true }).click();
}
