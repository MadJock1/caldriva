import { describe, expect, it } from "vitest";
import { STANDARD_BREAKER_RATINGS_A } from "./catalogue";
import { lineCurrentA } from "./loads";
import { sizeCircuit, voltageDropPercent, type SizingResult } from "./sizing";

const base = {
  lengthM: 10,
  phases: 1 as const,
  voltageV: 230,
  installMethod: "concealed_in_wall" as const,
  maxVoltageDropPct: 3,
  loadType: "socket",
};

function manualFindings(result: SizingResult) {
  return result.findings.filter((finding) => finding.status === "manual");
}

describe("breaker selection boundaries", () => {
  it("selects the smallest standard rating at or above the design current", () => {
    expect(sizeCircuit({ ...base, designCurrentA: 6 }).breakerA).toBe(6);
    expect(sizeCircuit({ ...base, designCurrentA: 10 }).breakerA).toBe(10);
    expect(sizeCircuit({ ...base, designCurrentA: 16 }).breakerA).toBe(16);
    expect(sizeCircuit({ ...base, designCurrentA: 16.0001 }).breakerA).toBe(20);
    expect(sizeCircuit({ ...base, designCurrentA: 100 }).breakerA).toBe(100);
  });

  it("returns a manual finding, not a guess, above the largest rating", () => {
    const result = sizeCircuit({ ...base, designCurrentA: 100.01 });
    expect(result.breakerA).toBeNull();
    expect(result.cableMm2).toBeNull();
    expect(manualFindings(result).some((finding) => finding.id === "sizing_breaker")).toBe(true);
  });
});

describe("cable sizing", () => {
  it("upsizes the cable when the smallest capacity-fitting size exceeds the voltage-drop limit", () => {
    // 16 A device: 1.5 mm² fails capacity, so the smallest capacity-fitting cable is 2.5 mm².
    // Over 30 m at 3% single-phase the 2.5 mm² run exceeds the limit, forcing 4 mm².
    const result = sizeCircuit({ ...base, designCurrentA: 16, lengthM: 30, maxVoltageDropPct: 3 });
    expect(result.breakerA).toBe(16);
    expect(result.cableMm2).toBe(4);
    expect(result.voltageDropPct).not.toBeNull();
    expect(result.voltageDropPct!).toBeLessThanOrEqual(3);
  });

  it("keeps the smallest capacity-fitting cable when the drop is acceptable", () => {
    const result = sizeCircuit({ ...base, designCurrentA: 16, lengthM: 5, maxVoltageDropPct: 3 });
    expect(result.cableMm2).toBe(2.5);
  });

  it("returns a manual finding when no bundled cable satisfies capacity and drop", () => {
    const result = sizeCircuit({ ...base, designCurrentA: 16, lengthM: 100000 });
    expect(result.breakerA).toBe(16);
    expect(result.cableMm2).toBeNull();
    expect(result.voltageDropPct).toBeNull();
    expect(manualFindings(result).some((finding) => finding.id === "sizing_cable")).toBe(true);
  });
});

describe("three-phase versus single-phase", () => {
  it("derives a lower line current for three-phase at the same apparent power", () => {
    const apparentVA = 16000;
    const single = lineCurrentA(apparentVA, 230, 1);
    const three = lineCurrentA(apparentVA, 400, 3);
    expect(three).toBeLessThan(single);
    const threeResult = sizeCircuit({ ...base, designCurrentA: three, voltageV: 400, phases: 3 });
    const singleResult = sizeCircuit({ ...base, designCurrentA: single, voltageV: 230, phases: 1 });
    expect(threeResult.breakerA).not.toBeNull();
    expect(singleResult.breakerA).not.toBeNull();
    expect(threeResult.breakerA!).toBeLessThan(singleResult.breakerA!);
  });

  it("computes a smaller voltage drop for three-phase at identical current and length", () => {
    const shared = { currentA: 20, lengthM: 40, voltageV: 230, csaMm2: 4 };
    const single = voltageDropPercent({ ...shared, phases: 1 });
    const three = voltageDropPercent({ ...shared, phases: 3, voltageV: 400 });
    expect(three).toBeLessThan(single);
  });
});

describe("verification findings", () => {
  it("always surfaces a visible finding for unverified data, even on success", () => {
    const result = sizeCircuit({ ...base, designCurrentA: 16, lengthM: 5 });
    expect(result.breakerA).not.toBeNull();
    const unverified = result.findings.filter((finding) => finding.id.includes("unverified"));
    expect(unverified.length).toBeGreaterThan(0);
    expect(unverified.some((finding) => finding.status === "warn" || finding.status === "manual")).toBe(true);
  });

  it("always surfaces the unverified finding on the no-fit path too", () => {
    const result = sizeCircuit({ ...base, designCurrentA: 16, lengthM: 100000 });
    expect(result.findings.some((finding) => finding.id === "sizing_data_unverified")).toBe(true);
  });

  it("never returns an approved or pass-only verdict without the unverified warning", () => {
    const allowed = new Set(["pass", "warn", "blocked", "manual"]);
    const result = sizeCircuit({ ...base, designCurrentA: 10, lengthM: 5 });
    for (const finding of result.findings) expect(allowed.has(finding.status)).toBe(true);
    expect(result.findings.some((finding) => (finding.status as string) === "approved")).toBe(false);
  });

  it("exposes the bounded standard rating list used for selection", () => {
    expect(STANDARD_BREAKER_RATINGS_A).toEqual([6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100]);
  });
});

describe("conductor material support", () => {
  it("refuses to select a cable for a non-copper material instead of reusing the copper table", () => {
    const result = sizeCircuit({ ...base, designCurrentA: 16, lengthM: 5, material: "aluminium" });
    expect(result.breakerA).toBeNull();
    expect(result.cableMm2).toBeNull();
    expect(result.voltageDropPct).toBeNull();
    expect(manualFindings(result).some((finding) => finding.id === "sizing_material_unsupported")).toBe(true);
  });
});
