import { initialBuilding } from "../src/lib/building";
import { defaultLayout } from "../src/lib/panel-layout";
import { assumptions, type SimulationSnapshot } from "../src/lib/simulation";

export const simulationFixture: SimulationSnapshot = {
  schemaVersion: 2,
  name: "Test scenario",
  building: { ...initialBuilding, name: "Test building", locationSource: "manual", locationConfirmed: true, roof: [[38.7223, -9.1393], [38.7223, -9.13915], [38.7224, -9.13915], [38.7224, -9.1393]] },
  layout: defaultLayout,
  panel: { panelModelId: "example-mono-430", label: "Example 430 W monocrystalline", widthM: 1.13, lengthM: 1.76, watts: 430, verified: false, layoutCount: 10, countSource: "manual" },
  result: { annualKwh: 6000, capacityKwp: 4.3, specificYield: 6000 / 4.3, monthly: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, E_m: 500 })), database: "TEST FIXTURE ONLY", source: "Deterministic automated-test fixture", calculatedAt: "2026-01-01T00:00:00Z", engineVersion: "solar-0.1.0" },
  assumptions: [...assumptions],
};

/** Version 1 snapshot shape (no panel record) used to exercise load-time migration. */
export const legacySimulationFixture: Record<string, unknown> = { ...simulationFixture, schemaVersion: 1 };
delete legacySimulationFixture.panel;
