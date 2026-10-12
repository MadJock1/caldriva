import { z } from "zod";
import { complianceRevisionSchema } from "./revisions";

// Phase 8 domain shapes for the qualified reviewer workflow. These mirror the SQL
// constraints in migration 202610120003. Reviewer qualification is an in-system
// administrator attestation, and a recorded decision is still not certification.

export const REVIEWER_STATUSES = ["active", "suspended"] as const;
export const REVIEW_DECISIONS = ["APPROVED", "APPROVED_WITH_COMMENTS", "CHANGES_REQUIRED", "REJECTED", "RETURNED"] as const;
export type ReviewDecision = typeof REVIEW_DECISIONS[number];
export const reviewDecisionLabels: Record<ReviewDecision, string> = {
  APPROVED: "Approved by reviewer",
  APPROVED_WITH_COMMENTS: "Approved with comments",
  CHANGES_REQUIRED: "Changes required",
  REJECTED: "Rejected",
  RETURNED: "Returned for information",
};
export const REVIEW_ASSIGNMENT_STATUSES = ["assigned", "declined", "completed"] as const;

export const REVIEW_WORKFLOW_DISCLAIMER =
  "A recorded decision states an authenticated reviewer's opinion on the frozen revision. It is not certification, a CE declaration of conformity, an installation inspection certificate, or approval for construction. Qualification entries are administrator-attested records inside this system, not independently verified credentials.";

export const reviewerQualificationSchema = z.object({
  user_id: z.uuid(),
  qualification: z.string().min(1).max(200),
  qualification_ref: z.string().max(300).nullable(),
  valid_until: z.string().max(40).nullable(),
  status: z.enum(REVIEWER_STATUSES),
  attested_by: z.uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ReviewerQualification = z.infer<typeof reviewerQualificationSchema>;

export const cloudComplianceRevisionSchema = z.object({
  id: z.uuid(),
  owner_id: z.uuid(),
  design_id: z.uuid(),
  revision_number: z.number().int().positive(),
  fingerprint: z.string().regex(/^[0-9a-f]{8,64}$/),
  registry_version: z.string().max(80),
  engine_version: z.string().max(40),
  category: z.string().max(40).nullable(),
  jurisdiction: z.string().max(40).nullable(),
  snapshot: complianceRevisionSchema,
  created_at: z.string(),
});
export type CloudComplianceRevision = z.infer<typeof cloudComplianceRevisionSchema>;

export const reviewAssignmentSchema = z.object({
  id: z.uuid(),
  revision_id: z.uuid(),
  owner_id: z.uuid(),
  reviewer_id: z.uuid(),
  status: z.enum(REVIEW_ASSIGNMENT_STATUSES),
  created_at: z.string(),
});
export type ReviewAssignment = z.infer<typeof reviewAssignmentSchema>;

export const reviewDecisionRecordSchema = z.object({
  id: z.uuid(),
  revision_id: z.uuid(),
  assignment_id: z.uuid().nullable(),
  owner_id: z.uuid(),
  reviewer_id: z.uuid(),
  decision: z.enum(REVIEW_DECISIONS),
  statement: z.string().max(5000).nullable(),
  decided_at: z.string(),
});
export type ReviewDecisionRecord = z.infer<typeof reviewDecisionRecordSchema>;

export const auditEventSchema = z.object({
  owner_id: z.uuid(),
  revision_id: z.uuid().nullable(),
  actor_id: z.uuid(),
  action: z.string().max(60),
  detail: z.record(z.string(), z.unknown()),
  created_at: z.string(),
});
export type AuditEvent = z.infer<typeof auditEventSchema>;

export const setReviewerQualificationSchema = z.object({
  userId: z.uuid(),
  qualification: z.string().trim().min(1, "Qualification is required").max(200),
  qualificationRef: z.string().trim().max(300).optional(),
  validUntil: z.iso.date().nullable().optional(),
});

export const registerRevisionSchema = z.object({
  designId: z.uuid(),
});

export const assignReviewerSchema = z.object({
  revisionId: z.uuid(),
  reviewerId: z.uuid(),
});

export const submitDecisionSchema = z.object({
  assignmentId: z.uuid(),
  decision: z.enum(REVIEW_DECISIONS),
  statement: z.string().trim().max(5000).optional(),
});

/** An attestation applies only while active and not past its (optional) expiry date. */
export function qualificationIsActive(qualification: ReviewerQualification, today = new Date().toISOString().slice(0, 10)): boolean {
  if (qualification.status !== "active") return false;
  return qualification.valid_until === null || qualification.valid_until >= today;
}
