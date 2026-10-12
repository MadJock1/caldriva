import { describe, expect, it } from "vitest";
import { capacity, financialScenario, pvgisAspect, solarInputSchema } from "./solar";
import { buildingSchema, horizontalRoofArea, initialBuilding } from "./building";
describe("solar units and assumptions", () => {
  it("converts panel Wp to system kWp", () => { expect(capacity(initialBuilding.solar)).toBe(4.3); });
  it("converts compass orientation to PVGIS convention", () => { expect([0, 90, 180, 270, 360].map(pvgisAspect)).toEqual([-180, -90, 0, 90, 180]); });
  it("rejects invalid location, fractional count and nonfinite power", () => {
    for (const patch of [{ latitude: 91 }, { panels: 1.5 }, { panelWatts: NaN }]) expect(solarInputSchema.safeParse({ ...initialBuilding.solar, ...patch }).success).toBe(false);
  });
  it("conserves energy and caps self-use at consumption", () => {
    const f = financialScenario(6000, { consumption: 2000, selfConsumption: 80, importTariff: .25, exportTariff: .05, capex: 6000, annualOpex: 100 });
    expect(f.selfUsed).toBe(2000); expect(f.exported).toBe(4000); expect(f.netSavings).toBe(600); expect(f.payback).toBe(10);
  });
  it("does not invent payback when operating costs exceed savings", () => {
    expect(financialScenario(0, initialBuilding.finance).payback).toBeNull();
  });
});
describe("roof geometry", () => {
  it("computes an approximately 111.2 m square at the equator", () => {
    expect(horizontalRoofArea([[0, 0], [0, .001], [.001, .001], [.001, 0]])).toBeCloseTo(12364.35, 0);
  });
  it("rejects crossed edges", () => { expect(() => horizontalRoofArea([[0, 0], [.001, .001], [0, .001], [.001, 0]])).toThrow(/cross/); });
  it("preserves obstacle geometry in saved building drafts", () => {
    const restored = buildingSchema.parse(JSON.parse(JSON.stringify({ ...initialBuilding, roofObstacles: [[[38.7, -9.1], [38.7, -9.0999], [38.7001, -9.0999]]] })));
    expect(restored.roofObstacles).toHaveLength(1);
  });
});
