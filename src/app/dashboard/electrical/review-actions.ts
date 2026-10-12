"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { serverSupabase } from "@/lib/supabase/server";
import { electricalDraftSchema } from "@/lib/electrical/cloud";
import { createComplianceRevision, nextRevisionNumber, type ComplianceRevision } from "@/lib/engineering/compliance/revisions";
import {
  assignReviewerSchema,
  auditEventSchema,
  cloudComplianceRevisionSchema,
  registerRevisionSchema,
  reviewAssignmentSchema,
  reviewDecisionRecordSchema,
  reviewerQualificationSchema,
  setReviewerQualificationSchema,
  submitDecisionSchema,
  type AuditEvent,
  type CloudComplianceRevision,
  type ReviewAssignment,
  type ReviewDecisionRecord,
  type ReviewerQualification,
} from "@/lib/engineering/compliance/review";

type Outcome<T> = { data: T; error?: never } | { error: string; data?: never };

async function authenticatedClient() {
  const client = await serverSupabase();
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { client, userId: data.user.id };
}

export type ReviewWorkspace = {
  qualification: ReviewerQualification | null;
  revisions: CloudComplianceRevision[];
  reviewerAssignments: ReviewAssignment[];
  ownedAssignments: ReviewAssignment[];
  decisions: ReviewDecisionRecord[];
};

export async function loadReviewWorkspace(): Promise<Outcome<ReviewWorkspace>> {
  const session = await authenticatedClient();
  if (!session) return { error: "Sign in to use the professional-review workspace." };
  const [qual, revisions, reviewerAssignments, ownedAssignments, decisions] = await Promise.all([
    session.client.from("compliance_reviewers").select("*").eq("user_id", session.userId).maybeSingle(),
    session.client.from("compliance_revisions").select("*").order("created_at", { ascending: false }).limit(100),
    session.client.from("compliance_review_assignments").select("*").eq("reviewer_id", session.userId).order("created_at", { ascending: false }).limit(100),
    session.client.from("compliance_review_assignments").select("*").eq("owner_id", session.userId).order("created_at", { ascending: false }).limit(100),
    session.client.from("compliance_review_decisions").select("*").order("decided_at", { ascending: false }).limit(100),
  ]);
  if (qual.error || revisions.error || reviewerAssignments.error || ownedAssignments.error || decisions.error)
    return { error: "Could not load the review workspace. Check the connection and database migration." };
  const parsedQual = qual.data ? reviewerQualificationSchema.safeParse(qual.data) : null;
  if (parsedQual && !parsedQual.success) return { error: "The stored review records are incompatible with this version." };
  const parsed = z.object({
    revisions: z.array(cloudComplianceRevisionSchema),
    reviewerAssignments: z.array(reviewAssignmentSchema),
    ownedAssignments: z.array(reviewAssignmentSchema),
    decisions: z.array(reviewDecisionRecordSchema),
  }).safeParse({
    revisions: revisions.data, reviewerAssignments: reviewerAssignments.data,
    ownedAssignments: ownedAssignments.data, decisions: decisions.data,
  });
  if (!parsed.success) return { error: "The stored review records are incompatible with this version." };
  return { data: { qualification: parsedQual ? parsedQual.data : null, ...parsed.data } };
}

// Registers a frozen revision for one of the caller's saved designs. The evaluation
// snapshot is rebuilt server-side from the stored draft, so the client cannot forge it.
export async function registerRevision(payload: unknown): Promise<Outcome<{ id: string; revisionNumber: number }>> {
  const session = await authenticatedClient();
  if (!session) return { error: "Sign in to register a revision." };
  const parsed = registerRevisionSchema.safeParse(payload);
  if (!parsed.success) return { error: "Invalid revision request." };
  const { data: design, error } = await session.client.from("electrical_designs")
    .select("id,electrical_drafts(draft)").eq("id", parsed.data.designId).eq("owner_id", session.userId).maybeSingle();
  if (error || !design) return { error: "Design unavailable or not authorized." };
  const draft = z.object({ electrical_drafts: z.object({ draft: electricalDraftSchema }) }).safeParse(design);
  if (!draft.success) return { error: "This design draft is incompatible with this application version." };
  const existing = await session.client.from("compliance_revisions").select("revision_number").eq("design_id", parsed.data.designId);
  if (existing.error) return { error: "Could not read existing revisions." };
  const numbers = z.array(z.object({ revision_number: z.number().int().positive() })).safeParse(existing.data);
  const revisionNumber = nextRevisionNumber((numbers.success ? numbers.data : []).map(r => ({ revisionNumber: r.revision_number }) as ComplianceRevision));
  const snapshot = createComplianceRevision(draft.data.electrical_drafts.draft, { revisionNumber });
  const saved = await session.client.rpc("register_compliance_revision", { p_design_id: parsed.data.designId, p_snapshot: snapshot });
  if (saved.error) return { error: "Could not register the revision. It may be unavailable, or the database is not configured." };
  const row = z.array(z.object({ id: z.uuid(), revision_number: z.number().int().positive() })).length(1).safeParse(saved.data);
  if (!row.success) return { error: "Registration returned an unexpected response." };
  revalidatePath("/dashboard/electrical/review");
  return { data: { id: row.data[0].id, revisionNumber: row.data[0].revision_number } };
}

export async function assignReviewer(payload: unknown): Promise<Outcome<{ assignmentId: string }>> {
  const session = await authenticatedClient();
  if (!session) return { error: "Sign in to assign a reviewer." };
  const parsed = assignReviewerSchema.safeParse(payload);
  if (!parsed.success) return { error: "Invalid assignment request." };
  const { data, error } = await session.client.rpc("assign_compliance_reviewer", { p_revision_id: parsed.data.revisionId, p_reviewer_id: parsed.data.reviewerId });
  if (error) return { error: error.code === "22023" ? "That reviewer is not actively qualified, or the revision owner cannot self-review." : "Could not assign the reviewer." };
  const row = z.array(z.object({ assignment_id: z.uuid() })).length(1).safeParse(data);
  if (!row.success) return { error: "Assignment returned an unexpected response." };
  revalidatePath("/dashboard/electrical/review");
  return { data: { assignmentId: row.data[0].assignment_id } };
}

export async function submitDecision(payload: unknown): Promise<Outcome<{ decisionId: string }>> {
  const session = await authenticatedClient();
  if (!session) return { error: "Sign in to record a decision." };
  const parsed = submitDecisionSchema.safeParse(payload);
  if (!parsed.success) return { error: "Choose a decision and keep the statement under 5000 characters." };
  const { data, error } = await session.client.rpc("submit_review_decision", {
    p_assignment_id: parsed.data.assignmentId, p_decision: parsed.data.decision, p_statement: parsed.data.statement ?? null,
  });
  if (error) return { error: error.code === "40001" ? "A decision already exists for this revision." : "Could not record the decision. You must be the assigned, actively qualified reviewer." };
  const row = z.array(z.object({ decision_id: z.uuid() })).length(1).safeParse(data);
  if (!row.success) return { error: "The decision returned an unexpected response." };
  revalidatePath("/dashboard/electrical/review");
  return { data: { decisionId: row.data[0].decision_id } };
}

export async function declineAssignment(payload: unknown): Promise<Outcome<true>> {
  const session = await authenticatedClient();
  if (!session) return { error: "Sign in to decline an assignment." };
  const parsed = z.object({ assignmentId: z.uuid() }).safeParse(payload);
  if (!parsed.success) return { error: "Invalid assignment reference." };
  const { error } = await session.client.rpc("decline_review_assignment", { p_assignment_id: parsed.data.assignmentId });
  if (error) return { error: "Could not decline this assignment." };
  revalidatePath("/dashboard/electrical/review");
  return { data: true };
}

export async function setReviewerQualification(payload: unknown): Promise<Outcome<true>> {
  const session = await authenticatedClient();
  if (!session) return { error: "Sign in to record a qualification." };
  const parsed = setReviewerQualificationSchema.safeParse(payload);
  if (!parsed.success) return { error: "Enter a qualification (up to 200 characters)." };
  const { error } = await session.client.rpc("set_reviewer_qualification", {
    p_user_id: parsed.data.userId, p_qualification: parsed.data.qualification,
    p_qualification_ref: parsed.data.qualificationRef ?? null, p_valid_until: parsed.data.validUntil ?? null,
  });
  if (error) return { error: error.code === "42501" ? "Administrator access is required to attest a qualification." : "Could not record the qualification." };
  revalidatePath("/dashboard/electrical/review");
  return { data: true };
}

export async function loadAudit(revisionId: unknown): Promise<Outcome<AuditEvent[]>> {
  const session = await authenticatedClient();
  if (!session) return { error: "Sign in to read the audit trail." };
  const parsed = z.uuid().safeParse(revisionId);
  if (!parsed.success) return { error: "Invalid revision reference." };
  const { data, error } = await session.client.from("compliance_audit_log").select("*").eq("revision_id", parsed.data).order("created_at", { ascending: true }).limit(200);
  if (error) return { error: "Could not read the audit trail." };
  const events = z.array(auditEventSchema).safeParse(data);
  return events.success ? { data: events.data } : { error: "The audit records are incompatible with this version." };
}
