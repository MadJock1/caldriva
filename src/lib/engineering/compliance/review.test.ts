import { describe, expect, it } from "vitest";
import { initialElectricalBuilding } from "../../electrical/model";
import { createComplianceRevision } from "./revisions";
import {
  REVIEW_DECISIONS,
  cloudComplianceRevisionSchema,
  qualificationIsActive,
  registerRevisionSchema,
  setReviewerQualificationSchema,
  submitDecisionSchema,
  type ReviewerQualification,
} from "./review";

const qualification = (over: Partial<ReviewerQualification> = {}): ReviewerQualification => ({
  user_id: "33333333-3333-4333-8333-333333333333",
  qualification: "Chartered electrical engineer",
  qualification_ref: null,
  valid_until: null,
  status: "active",
  attested_by: "44444444-4444-4444-8444-444444444444",
  created_at: "2026-10-12T00:00:00.000Z",
  updated_at: "2026-10-12T00:00:00.000Z",
  ...over,
});

describe("reviewer workflow domain schema", () => {
  it("exposes a label for every decision", () => {
    expect(REVIEW_DECISIONS).toHaveLength(5);
    for (const decision of REVIEW_DECISIONS)
      expect(decision).toBeTruthy();
  });

  it("validates and normalises a qualification attestation", () => {
    expect(setReviewerQualificationSchema.safeParse({ userId: qualification().user_id, qualification: "  " }).success).toBe(false);
    const parsed = setReviewerQualificationSchema.parse({ userId: qualification().user_id, qualification: "  RTIEBT reviewer  ", qualificationRef: "REG-1" });
    expect(parsed.qualification).toBe("RTIEBT reviewer");
  });

  it("accepts a design reference and rejects an invalid one", () => {
    expect(registerRevisionSchema.safeParse({ designId: "11111111-1111-4111-8111-111111111111" }).success).toBe(true);
    expect(registerRevisionSchema.safeParse({ designId: "not-a-uuid" }).success).toBe(false);
  });

  it("validates a stored cloud revision row", () => {
    const revision = createComplianceRevision(initialElectricalBuilding, { revisionNumber: 1, now: "2026-10-12T00:00:00.000Z" });
    const row = {
      id: "11111111-1111-4111-8111-111111111111",
      owner_id: "22222222-2222-4222-8222-222222222222",
      design_id: "33333333-3333-4333-8333-333333333333",
      revision_number: 1,
      fingerprint: revision.fingerprint,
      registry_version: revision.registryVersion,
      engine_version: revision.engineVersion,
      category: "residential",
      jurisdiction: "PT",
      snapshot: revision,
      created_at: "2026-10-12T00:00:00.000Z",
    };
    expect(cloudComplianceRevisionSchema.safeParse(row).success).toBe(true);
    expect(cloudComplianceRevisionSchema.safeParse({ ...row, fingerprint: "not hex" }).success).toBe(false);
  });

  it("only treats an attestation as active when unexpired", () => {
    expect(qualificationIsActive(qualification(), "2026-10-12")).toBe(true);
    expect(qualificationIsActive(qualification({ valid_until: "2026-10-11" }), "2026-10-12")).toBe(false);
    expect(qualificationIsActive(qualification({ status: "suspended" }), "2026-10-12")).toBe(false);
  });

  it("rejects an unknown decision", () => {
    expect(submitDecisionSchema.safeParse({ assignmentId: "11111111-1111-4111-8111-111111111111", decision: "CERTIFIED" }).success).toBe(false);
    expect(submitDecisionSchema.safeParse({ assignmentId: "11111111-1111-4111-8111-111111111111", decision: "APPROVED" }).success).toBe(true);
  });
});
