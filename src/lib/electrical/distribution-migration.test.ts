import { describe, expect, it } from "vitest";
import { initialElectricalBuilding, migrateElectricalBuildingDraft, parseElectricalBuildingDraft } from "./model";

function legacyDraft(): Record<string, unknown> {
  const legacy: Record<string, unknown> = { ...initialElectricalBuilding, version: 1 };
  delete legacy.distribution;
  return legacy;
}

describe("electrical draft schema migration", () => {
  it("upgrades a version 1 draft to version 2 with a null distribution", () => {
    const migrated = migrateElectricalBuildingDraft(legacyDraft()) as Record<string, unknown>;
    expect(migrated.version).toBe(2);
    expect(migrated.distribution).toBeNull();
  });

  it("loads a legacy version 1 draft without crashing", () => {
    const parsed = parseElectricalBuildingDraft(legacyDraft());
    expect(parsed.version).toBe(2);
    expect(parsed.distribution).toBeNull();
  });

  it("round-trips a new version 2 draft through serialization", () => {
    const parsed = parseElectricalBuildingDraft(initialElectricalBuilding);
    const restored = parseElectricalBuildingDraft(JSON.parse(JSON.stringify(parsed)));
    expect(restored).toEqual(parsed);
    expect(restored.distribution).toBeNull();
  });

  it("leaves an already-versioned draft unchanged", () => {
    expect(migrateElectricalBuildingDraft(initialElectricalBuilding)).toEqual(initialElectricalBuilding);
  });
});
