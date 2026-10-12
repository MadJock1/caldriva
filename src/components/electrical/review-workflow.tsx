"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ElectricalSummary } from "@/lib/electrical/cloud";
import {
  assignReviewer,
  declineAssignment,
  loadAudit,
  loadReviewWorkspace,
  registerRevision,
  setReviewerQualification,
  submitDecision,
  type ReviewWorkspace,
} from "@/app/dashboard/electrical/review-actions";
import {
  REVIEW_DECISIONS,
  REVIEW_WORKFLOW_DISCLAIMER,
  qualificationIsActive,
  reviewDecisionLabels,
  type AuditEvent,
  type ReviewDecision,
} from "@/lib/engineering/compliance/review";

const field = "block w-full mt-1 p-2 rounded-lg border border-border bg-surface text-sm";

export function ReviewWorkflow({ userId, role, designs, initial }: {
  userId: string; role: "customer" | "engineer" | "admin"; designs: ElectricalSummary[]; initial: ReviewWorkspace;
}) {
  const [ws, setWs] = useState(initial);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const [designId, setDesignId] = useState("");
  const [assignRevisionId, setAssignRevisionId] = useState("");
  const [assignReviewerId, setAssignReviewerId] = useState("");
  const [audit, setAudit] = useState<Record<string, AuditEvent[]>>({});
  const [drafts, setDrafts] = useState<Record<string, { decision: ReviewDecision; statement: string }>>({});

  function run(task: () => Promise<void>) {
    setError(""); setMessage("");
    start(async () => { try { await task(); } catch { setError("The action failed. Please retry."); } });
  }
  async function refresh(): Promise<string> {
    const result = await loadReviewWorkspace();
    if (result.error || !result.data) { const failure = result.error ?? "Could not refresh the workspace."; setError(failure); return failure; }
    setWs(result.data); return "";
  }
  const designName = (id: string) => designs.find(d => d.id === id)?.name ?? id;

  const myRevisions = ws.revisions.filter(r => r.owner_id === userId);
  const pendingForMe = ws.reviewerAssignments.filter(a => a.status === "assigned");
  const reviewerActive = ws.qualification !== null && qualificationIsActive(ws.qualification);

  return <div className="space-y-6 mt-6">
    <p className="text-sm text-text-muted">{REVIEW_WORKFLOW_DISCLAIMER}</p>
    <div role="status" aria-live="polite" className="text-sm">{message}</div>
    {error && <p role="alert" className="text-error">{error}</p>}

    <section className="border border-border rounded-xl bg-surface p-5 space-y-3">
      <h2 className="text-xl font-semibold">Qualification record</h2>
      {ws.qualification ? (
        <p className="text-sm text-text-muted">
          {ws.qualification.qualification}{ws.qualification.qualification_ref ? ` · ${ws.qualification.qualification_ref}` : ""} ·{" "}
          <strong className={reviewerActive ? "text-success" : "text-warning"}>{qualificationIsActive(ws.qualification) ? "Active" : ws.qualification.status === "suspended" ? "Suspended" : "Expired"}</strong>{" "}
          · valid until {ws.qualification.valid_until ?? "no expiry"}
        </p>
      ) : (
        <p className="text-sm text-text-muted">{role === "admin" ? "Attest a reviewer below." : "You are not registered as a reviewer."}</p>
      )}
      {role === "admin" && <QualificationForm busy={busy} onSubmit={payload => run(async () => {
        const result = await setReviewerQualification(payload);
        if (result.error) { setError(result.error); return; }
        setMessage("Qualification recorded."); await refresh();
      })} />}
    </section>

    <section className="border border-border rounded-xl bg-surface p-5 space-y-3">
      <h2 className="text-xl font-semibold">Register an immutable revision</h2>
      <p className="text-sm text-text-muted">Freezes the current cloud design evaluation. The snapshot is rebuilt server-side from the saved draft. Revisions are append-only and cloud-hosted.</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm min-w-64">Cloud design<select aria-label="Cloud design to register" className={field} value={designId} onChange={e => setDesignId(e.target.value)}><option value="" disabled>Select a saved design</option>{designs.map(d => <option key={d.id} value={d.id}>{d.name} (v{d.version})</option>)}</select></label>
        <Button disabled={busy || !designId} onClick={() => run(async () => {
          const result = await registerRevision({ designId });
          if (result.error || !result.data) { setError(result.error ?? "Registration failed."); return; }
          const number = result.data.revisionNumber;
          setMessage(`Revision ${number} registered.`); await refresh();
        })}>Register revision</Button>
      </div>
    </section>

    <section className="border border-border rounded-xl bg-surface p-5 space-y-3">
      <h2 className="text-xl font-semibold">Your revisions</h2>
      {myRevisions.length === 0 ? <p className="text-sm text-text-muted">No cloud revisions yet.</p> : (
        <ul className="space-y-2">
          {myRevisions.map(revision => <li key={revision.id} className="border border-border rounded-lg p-3 text-sm">
            <p className="font-medium">Revision {revision.revision_number} · <span className="font-mono">{revision.id}</span></p>
            <p className="text-text-muted">{designName(revision.design_id)} · {revision.created_at.slice(0, 19)} · registry {revision.registry_version} · fingerprint <span className="font-mono">{revision.fingerprint}</span></p>
            <div className="mt-2 flex flex-wrap gap-3 items-center">
              {role === "admin" && <Button variant="outline" onClick={() => { setAssignRevisionId(revision.id); setMessage("Revision selected for assignment."); }}>Select for assignment</Button>}
              <Button variant="outline" disabled={busy} onClick={() => run(async () => {
                const result = await loadAudit(revision.id);
                if (result.error || !result.data) { setError(result.error ?? "Could not load the audit trail."); return; }
                const events = result.data;
                setAudit(prev => ({ ...prev, [revision.id]: events }));
              })}>Load audit trail</Button>
            </div>
            {audit[revision.id] && <ul className="mt-2 text-xs text-text-muted space-y-1">{audit[revision.id].map((event, index) => <li key={index}>{event.created_at.slice(0, 19)} · {event.action} · actor <span className="font-mono">{event.actor_id.slice(0, 8)}</span></li>)}</ul>}
          </li>)}
        </ul>
      )}
      {role === "admin" && <div className="border border-border rounded-lg p-3 space-y-2">
        <h3 className="font-medium text-sm">Assign a reviewer</h3>
        <p className="text-xs text-text-muted">A revision owner cannot review their own revision; the reviewer must have an active, unexpired attestation.</p>
        <label className="text-sm block">Revision id<Input aria-label="Revision to assign" value={assignRevisionId} onChange={e => setAssignRevisionId(e.target.value)} placeholder="Select above or paste a revision id" /></label>
        <label className="text-sm block">Reviewer user id<Input aria-label="Reviewer user id" value={assignReviewerId} onChange={e => setAssignReviewerId(e.target.value)} placeholder="Reviewer account uuid" /></label>
        <Button disabled={busy || !assignRevisionId || !assignReviewerId} onClick={() => run(async () => {
          const result = await assignReviewer({ revisionId: assignRevisionId, reviewerId: assignReviewerId });
          if (result.error) { setError(result.error); return; }
          setMessage("Reviewer assigned."); setAssignReviewerId(""); await refresh();
        })}>Assign reviewer</Button>
      </div>}
    </section>

    <section className="border border-border rounded-xl bg-surface p-5 space-y-3">
      <h2 className="text-xl font-semibold">Decisions assigned to you</h2>
      {pendingForMe.length === 0 ? <p className="text-sm text-text-muted">No pending review assignments.</p> : (
        <ul className="space-y-3">
          {pendingForMe.map(assignment => {
            const draft = drafts[assignment.id] ?? { decision: "APPROVED_WITH_COMMENTS" as ReviewDecision, statement: "" };
            return <li key={assignment.id} className="border border-border rounded-lg p-3 text-sm space-y-2">
              <p>Revision <span className="font-mono">{assignment.revision_id}</span> · assigned {assignment.created_at.slice(0, 10)}</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-sm">Decision<select aria-label="Review decision" className={field} value={draft.decision} onChange={e => setDrafts(prev => ({ ...prev, [assignment.id]: { ...draft, decision: e.target.value as ReviewDecision } }))}>{REVIEW_DECISIONS.map(d => <option key={d} value={d}>{reviewDecisionLabels[d]}</option>)}</select></label>
                <label className="text-sm">Statement<Input aria-label="Decision statement" maxLength={5000} value={draft.statement} onChange={e => setDrafts(prev => ({ ...prev, [assignment.id]: { ...draft, statement: e.target.value } }))} /></label>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button disabled={busy} onClick={() => run(async () => {
                  const result = await submitDecision({ assignmentId: assignment.id, decision: draft.decision, statement: draft.statement || undefined });
                  if (result.error) { setError(result.error); return; }
                  setMessage("Decision recorded. It is immutable."); await refresh();
                })}>Record decision</Button>
                <Button variant="outline" disabled={busy} onClick={() => run(async () => {
                  const result = await declineAssignment({ assignmentId: assignment.id });
                  if (result.error) { setError(result.error); return; }
                  setMessage("Assignment declined."); await refresh();
                })}>Decline</Button>
              </div>
            </li>;
          })}
        </ul>
      )}
    </section>

    <section className="border border-border rounded-xl bg-surface p-5 space-y-3">
      <h2 className="text-xl font-semibold">Recorded decisions</h2>
      {ws.decisions.length === 0 ? <p className="text-sm text-text-muted">No decisions recorded.</p> : (
        <ul className="space-y-2 text-sm">
          {ws.decisions.map(decision => <li key={decision.id} className="border border-border rounded-lg p-3">
            <p><strong>{reviewDecisionLabels[decision.decision]}</strong> · revision <span className="font-mono">{decision.revision_id}</span> · {decision.decided_at.slice(0, 19)}</p>
            {decision.statement && <p className="text-text-muted mt-1">{decision.statement}</p>}
          </li>)}
        </ul>
      )}
    </section>
  </div>;
}

function QualificationForm({ busy, onSubmit }: { busy: boolean; onSubmit: (payload: { userId: string; qualification: string; qualificationRef?: string; validUntil?: string | null }) => void }) {
  const [userId, setUserId] = useState("");
  const [qualification, setQualification] = useState("");
  const [qualificationRef, setQualificationRef] = useState("");
  const [validUntil, setValidUntil] = useState("");
  return <div className="grid sm:grid-cols-2 gap-3">
    <label className="text-sm">Reviewer user id<Input aria-label="Qualification reviewer user id" value={userId} onChange={e => setUserId(e.target.value)} placeholder="Reviewer account uuid" /></label>
    <label className="text-sm">Qualification<Input aria-label="Qualification" maxLength={200} value={qualification} onChange={e => setQualification(e.target.value)} placeholder="e.g. Chartered electrical engineer" /></label>
    <label className="text-sm">Qualification reference<Input aria-label="Qualification reference" maxLength={300} value={qualificationRef} onChange={e => setQualificationRef(e.target.value)} /></label>
    <label className="text-sm">Valid until<Input aria-label="Qualification valid until" type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} /></label>
    <div><Button disabled={busy || !userId || !qualification.trim()} onClick={() => onSubmit({ userId, qualification, qualificationRef: qualificationRef || undefined, validUntil: validUntil || null })}>Record qualification</Button></div>
  </div>;
}
