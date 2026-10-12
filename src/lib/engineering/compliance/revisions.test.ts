import { describe, expect, it } from "vitest";
import { exampleProjects } from "../verification/examples";
import { evaluateCompliance } from "./evaluate";
import {
  appendRevision,
  complianceFingerprint,
  complianceRevisionListSchema,
  createComplianceRevision,
  isRevisionStale,
  nextRevisionNumber,
  parseRevisions,
} from "./revisions";

describe("compliance fingerprints and immutable revisions", () => {
  it("produces a deterministic, input-sensitive fingerprint", () => {
    const building = exampleProjects().A;
    const first = complianceFingerprint(building);
    expect(first).toBe(complianceFingerprint(structuredClone(building)));
    const edited = structuredClone(building);
    edited.commonLoads = [...edited.commonLoads, { ...edited.floors[0].apartments[0].rooms[0].loads[0], id: "extra", quantity: 3 }];
    expect(complianceFingerprint(edited)).not.toBe(first);
    const supplyEdit = structuredClone(building);
    supplyEdit.service = { ...supplyEdit.service, voltageV: 415 };
    expect(complianceFingerprint(supplyEdit)).not.toBe(first);
  });

  it("freezes a revision snapshot whose counts match the live evaluation", () => {
    const building = exampleProjects().A;
    const report = evaluateCompliance(building);
    const revision = createComplianceRevision(building, { revisionNumber: 1, createdBy: "Test author", now: "2026-10-12T10:00:00.000Z" });
    expect(revision.counts.pass).toBe(report.checks.filter(c => c.status === "PASS").length);
    expect(revision.counts.missingData).toBe(report.checks.filter(c => c.status === "MISSING DATA").length);
    expect(revision.checks).toHaveLength(report.checks.length);
    expect(revision.id).toContain("CR-1-");
    expect(revision.createdAt).toBe("2026-10-12T10:00:00.000Z");
    expect(revision.calculations.demandVA).toBe(report.calculations.demandVA);
    expect(Object.isFrozen(revision)).toBe(true);
    expect(() => { (revision as { revisionNumber: number }).revisionNumber = 2; }).toThrow();
  });

  it("round-trips through the schema and rejects inconsistent data", () => {
    const revision = createComplianceRevision(exampleProjects().B, { revisionNumber: 3 });
    expect(parseRevisions(JSON.parse(JSON.stringify([revision])))).toHaveLength(1);
    expect(complianceRevisionListSchema.safeParse([{ ...revision, revisionNumber: -1 }]).success).toBe(false);
    expect(parseRevisions("not-an-array")).toEqual([]);
  });

  it("numbers revisions ascending and appends without mutation", () => {
    const building = exampleProjects().A;
    const r1 = createComplianceRevision(building, { revisionNumber: 1 });
    const r2 = createComplianceRevision(building, { revisionNumber: nextRevisionNumber([r1]) });
    const list = appendRevision(appendRevision([], r1), r2);
    expect(list.map(r => r.revisionNumber)).toEqual([1, 2]);
    expect(nextRevisionNumber(list)).toBe(3);
    expect(list).toHaveLength(2);
  });

  it("detects a stale revision after the project changes", () => {
    const building = exampleProjects().A;
    const revision = createComplianceRevision(building, { revisionNumber: 1 });
    expect(isRevisionStale(revision, building)).toBe(false);
    const edited = structuredClone(building);
    edited.compliance = { ...(edited.compliance ?? {}), faultCurrentKa: 6, faultCurrentEvidence: "Transformer data" } as typeof edited.compliance;
    expect(isRevisionStale(revision, edited)).toBe(true);
    // The frozen revision itself is never mutated by the later edit.
    expect(revision.fingerprint).toBe(complianceFingerprint(building));
  });
});
