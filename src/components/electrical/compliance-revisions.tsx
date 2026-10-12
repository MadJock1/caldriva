"use client";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ElectricalBuilding } from "@/lib/electrical";
import {
  appendRevision,
  complianceFingerprint,
  createComplianceRevision,
  isRevisionStale,
  nextRevisionNumber,
  parseRevisions,
  type ComplianceRevision,
} from "@/lib/engineering/compliance/revisions";

const KEY = "caldriva-compliance-revisions-v1";
const EMPTY: ComplianceRevision[] = [];

// Browser-local append-only revision store read through useSyncExternalStore so the
// server renders an empty list and the client adopts the saved revisions after hydration.
let cache: ComplianceRevision[] | null = null;
const listeners = new Set<() => void>();

function load(): ComplianceRevision[] {
  try {
    const saved = localStorage.getItem(KEY);
    return saved ? parseRevisions(JSON.parse(saved)) : EMPTY;
  } catch {
    return EMPTY;
  }
}
function getSnapshot(): ComplianceRevision[] {
  if (cache === null) cache = load();
  return cache;
}
function getServerSnapshot(): ComplianceRevision[] {
  return EMPTY;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function writeRevisions(next: ComplianceRevision[]): boolean {
  cache = next;
  let ok = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    ok = false;
  }
  listeners.forEach(listener => listener());
  return ok;
}

export function ComplianceRevisions({ building }: { building: ElectricalBuilding }) {
  const revisions = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [author, setAuthor] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const fingerprint = useMemo(() => complianceFingerprint(building), [building]);

  function create() {
    setError("");
    setMessage("");
    const revision = createComplianceRevision(building, { createdBy: author, revisionNumber: nextRevisionNumber(revisions) });
    const saved = writeRevisions(appendRevision(revisions, revision));
    setMessage(`Revision ${revision.revisionNumber} created and frozen. Later edits will mark it stale rather than change it.${saved ? "" : " Browser storage is unavailable; this revision is held for the session only."}`);
  }

  async function download(revision: ComplianceRevision) {
    setError("");
    setMessage("");
    setBusyId(revision.id);
    try {
      const response = await fetch("/api/reports/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision, currentFingerprint: fingerprint }),
      });
      if (!response.ok) throw new Error("failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `compliance-${revision.id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage("Print-friendly PDF exported. It reproduces the frozen revision and is not a certificate.");
    } catch {
      setError("The compliance report could not be generated.");
    } finally {
      setBusyId(null);
    }
  }

  const ordered = [...revisions].sort((a, b) => b.revisionNumber - a.revisionNumber);

  return <div className="space-y-3">
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm">Revision author<Input className="mt-1" maxLength={120} value={author} placeholder="Project author name" onChange={e => setAuthor(e.target.value)} /></label>
      <Button onClick={create}>Create immutable revision</Button>
    </div>
    <p className="text-sm text-text-muted">
      A revision freezes the current evaluation, registry baseline and a content fingerprint of the project inputs. Revisions are append-only and cannot be
      edited; if the project later changes, the revision is shown as stale. The fingerprint is a software integrity check, not a digital signature.
    </p>
    <p className="text-xs text-text-muted">Current project fingerprint: <span className="font-mono">{fingerprint}</span></p>
    <div role="status" aria-live="polite" className="text-sm">{message}</div>
    {error && <p role="alert" className="text-error">{error}</p>}
    {ordered.length === 0 ? (
      <p className="text-sm text-text-muted">No revisions recorded in this browser yet.</p>
    ) : (
      <ul className="space-y-2">
        {ordered.map(revision => {
          const stale = isRevisionStale(revision, building);
          return (
            <li key={revision.id} className="border border-border rounded-lg p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">Revision {revision.revisionNumber} · <span className="font-mono">{revision.id}</span>
                    <span className={`ml-2 text-xs font-medium border rounded-full px-2.5 py-0.5 ${stale ? "text-warning border-warning/40 bg-warning-muted" : "text-success border-success/40 bg-success-muted"}`}>
                      {stale ? "Stale — project changed" : "Current"}
                    </span>
                  </p>
                  <p className="text-text-muted">{revision.createdAt} · {revision.createdBy || "author not recorded"} · registry {revision.registryVersion} · engine {revision.engineVersion}</p>
                  <p className="text-text-muted">fingerprint <span className="font-mono">{revision.fingerprint}</span> · Pass {revision.counts.pass} · Fail {revision.counts.fail} · Warning {revision.counts.warning} · Missing {revision.counts.missingData} · Review {revision.counts.requiresProfessionalReview}</p>
                </div>
                <Button variant="outline" disabled={busyId === revision.id} onClick={() => download(revision)}>{busyId === revision.id ? "Preparing…" : "Download PDF"}</Button>
              </div>
              {stale && <p className="text-xs text-warning mt-1">The project inputs no longer match this revision. Regenerate a new revision before relying on this record.</p>}
            </li>
          );
        })}
      </ul>
    )}
  </div>;
}
