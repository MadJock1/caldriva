import { expect, it } from "vitest";
import { buildingSchema, initialBuilding } from "./building";
it("keeps legacy drafts readable without treating default coordinates as confirmed", () => {
  const draft = buildingSchema.parse({ ...initialBuilding, locationConfirmed: undefined });
  expect(draft.locationConfirmed).toBe(false);
  expect(draft.locationSource).toBeUndefined();
});
it("persists manual location provenance and confirmation in version-one drafts", () => {
  const draft = buildingSchema.parse(JSON.parse(JSON.stringify({ ...initialBuilding, locationSource: "manual", locationConfirmed: true })));
  expect(draft.locationSource).toBe("manual");
  expect(draft.locationConfirmed).toBe(true);
});
