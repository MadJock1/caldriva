"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { saveBuilding } from "@/app/dashboard/buildings/actions";
import type { Building } from "@/lib/building";
import type { CloudIdentity } from "@/lib/cloud-building";
export function CloudDraftControls({ building, identity, onSaved }: { building: Building; identity: CloudIdentity | null; onSaved: (identity: CloudIdentity) => void }) {
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  function save(copy: boolean) {
    start(async () => { setMessage(""); try { const response = await saveBuilding({ identity: copy ? null : identity, draft: building }); if (response.error) setMessage(response.error); else if (response.data) { onSaved(response.data); setMessage(`Saved to your account (version ${response.data.version}).`); } } catch { setMessage("Cloud save failed. Your on-screen inputs are preserved."); } });
  }
  return <div className="bg-surface rounded-lg p-3 mt-2"><div className="flex flex-wrap gap-3 items-center"><Button variant="outline" loading={pending} onClick={() => save(false)}>{identity ? "Update cloud building" : "Save to account"}</Button>{identity && <Button variant="outline" disabled={pending} onClick={() => save(true)}>Save new cloud copy</Button>}<Link className="underline text-sm" href="/dashboard/buildings">Your cloud buildings</Link><Link className="underline text-sm" href="/login">Sign in to sync</Link></div><p role="status" className="text-sm">{pending ? "Saving…" : message}</p></div>;
}
