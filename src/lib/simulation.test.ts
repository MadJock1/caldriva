import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { defaultLayout, layoutPanels, panelLayout, rectangleFits, type XY } from "./panel-layout";
import { migratedSnapshotSchema, parseSimulationSnapshot, recomputeLayoutCount, snapshotSchema } from "./simulation";
import { generateSolarReport } from "./solar-report";
import { panelModelById } from "./solar-panel-catalog";
import { simulationFixture as fixture, legacySimulationFixture } from "../../tests/fixtures";

describe("simulation snapshot validation", () => {
  it("rejects mismatched capacity and monthly energy", () => {
    expect(snapshotSchema.safeParse(fixture).success).toBe(true);
    expect(snapshotSchema.safeParse({ ...fixture, result: { ...fixture.result, capacityKwp: 10 } }).success).toBe(false);
    expect(snapshotSchema.safeParse({ ...fixture, result: { ...fixture.result, annualKwh: 7000 } }).success).toBe(false);
    expect(snapshotSchema.safeParse({ ...fixture, result: { ...fixture.result, monthly: Array(12).fill({ month: 1, E_m: 500 }) } }).success).toBe(false);
  });
  it("rejects bad dates and invalid geometry", () => {
    expect(snapshotSchema.safeParse({ ...fixture, result: { ...fixture.result, calculatedAt: "not-a-date" } }).success).toBe(false);
    expect(snapshotSchema.safeParse({ ...fixture, building: { ...fixture.building, roof: [[0, 0], [.001, .001], [0, .001], [.001, 0]] } }).success).toBe(false);
  });
});
describe("solar snapshot version migration", () => {
  it("migrates a legacy version 1 snapshot to version 2 with a manual declared panel", () => {
    const parsed = migratedSnapshotSchema.safeParse(legacySimulationFixture);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.schemaVersion).toBe(2);
    expect(parsed.data.panel.panelModelId).toBe("legacy-declared");
    expect(parsed.data.panel.countSource).toBe("manual");
    expect(parsed.data.panel.watts).toBe(fixture.building.solar.panelWatts);
    expect(parsed.data.panel.layoutCount).toBe(fixture.building.solar.panels);
    expect(parsed.data.building.solar.panels).toBe(fixture.building.solar.panels);
  });
  it("round-trips a version 2 snapshot unchanged", () => {
    expect(parseSimulationSnapshot(fixture)).toEqual(fixture);
  });
  it("recomputes the layout panel count from the stored inputs", () => {
    expect(recomputeLayoutCount(fixture)).toBeGreaterThan(0);
  });
  it("changes the layout count when the panel model dimensions change", () => {
    const request = { orientation: "portrait" as const, setback: fixture.layout.setback, gap: fixture.layout.gap };
    const small = layoutPanels(fixture.building.roof, panelModelById("example-mono-430")!, request, fixture.building.solar.azimuth).count;
    const large = layoutPanels(fixture.building.roof, panelModelById("example-bifacial-550")!, request, fixture.building.solar.azimuth).count;
    expect(small).toBeGreaterThan(large);
  });
});
describe("preliminary horizontal layout", () => {
  it("fits grid rectangles entirely within the roof with edge clearance", () => {
    const result = panelLayout(fixture.building.roof, defaultLayout, 180);
    expect(result.panels.length).toBeGreaterThan(0);
    for (const rect of result.panels) expect(rectangleFits(rect, result.roof, defaultLayout.setback)).toBe(true);
  });
  it("rejects a panel spanning a concave notch even if all corners are inside", () => {
    const roof: XY[] = [[0, 0], [10, 0], [10, 10], [6, 10], [6, 4], [4, 4], [4, 10], [0, 10]];
    expect(rectangleFits([[2, 2], [8, 2], [8, 8], [2, 8]], roof, .5)).toBe(false);
  });
  it("rejects near-edge rectangles and reports missing geometry", () => {
    expect(rectangleFits([[.1, .1], [2, .1], [2, 2], [.1, 2]], [[0, 0], [10, 0], [10, 10], [0, 10]], .5)).toBe(false);
    expect(panelLayout([], defaultLayout, 180).panels).toHaveLength(0);
  });
});
describe("server generated PDF", () => {
  it("creates a readable multipage preliminary report with roof and chart content", async () => {
    const bytes = await generateSolarReport(fixture);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(3);
    expect(pdf.getTitle()).toContain("Preliminary solar PV report");
    expect(pdf.getSubject()).toContain("not engineer-reviewed, certified or approved");
    expect(bytes.byteLength).toBeGreaterThan(4000);
  });
  it("handles missing roofs, long names and unsupported glyphs without failing", async () => {
    const bytes = await generateSolarReport({ ...fixture, building: { ...fixture.building, roof: [], name: "長い建物 🏠 São João ".repeat(5) } });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
