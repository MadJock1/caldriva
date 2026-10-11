import { initialBuilding } from "../src/lib/building";
import { defaultLayout } from "../src/lib/panel-layout";
import { assumptions, type SimulationSnapshot } from "../src/lib/simulation";
export const simulationFixture: SimulationSnapshot = {
  schemaVersion: 1,
  name: "Test scenario",
  building: { ...initialBuilding, name: "Test building", locationSource: "manual", locationConfirmed: true, roof: [[38.7223, -9.1393], [38.7223, -9.13915], [38.7224, -9.13915], [38.7224, -9.1393]] },
  layout: defaultLayout,
  result: { annualKwh: 6000, capacityKwp: 4.3, specificYield: 6000 / 4.3, monthly: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, E_m: 500 })), database: "TEST FIXTURE ONLY", source: "Deterministic automated-test fixture", calculatedAt: "2026-01-01T00:00:00Z", engineVersion: "solar-0.1.0" },
  assumptions: [...assumptions],
};
