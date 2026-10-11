import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { defaultLayout, panelLayout, rectangleFits, type XY } from "./panel-layout";
import { snapshotSchema } from "./simulation";
import { generateSolarReport } from "./solar-report";
import { simulationFixture as fixture } from "../../tests/fixtures";

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
