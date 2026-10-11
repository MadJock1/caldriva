"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { saveElectricalDesign } from "@/app/dashboard/electrical/actions";
import type { ElectricalBuilding } from "@/lib/electrical";
import type { ElectricalIdentity } from "@/lib/electrical/cloud";

export function ElectricalCloudControls({ building, identity, onSaved }: { building: ElectricalBuilding; identity: ElectricalIdentity | null; onSaved: (identity: ElectricalIdentity) => void }) {
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  function save(copy: boolean) {
    start(async () => {
      setMessage("");
      try {
        const response = await saveElectricalDesign({ identity: copy ? null : identity, draft: building });
        if (response.error) setMessage(response.error);
        else if (response.data) { onSaved(response.data); setMessage(`Saved to your account (version ${response.data.version}).`); }
      } catch {
        setMessage("Cloud save failed. Your on-screen inputs are preserved.");
      }
    });
  }
  return (
    <div className="bg-surface rounded-lg p-3 mt-2">
      <div className="flex flex-wrap gap-3 items-center">
        <Button variant="outline" loading={pending} onClick={() => save(false)}>{identity ? "Update cloud design" : "Save to account"}</Button>
        {identity && <Button variant="outline" disabled={pending} onClick={() => save(true)}>Save new cloud copy</Button>}
        <Link className="underline text-sm" href="/dashboard/electrical">Your cloud designs</Link>
        <Link className="underline text-sm" href="/login">Sign in to sync</Link>
      </div>
      <p role="status" className="text-sm">{pending ? "Saving…" : message}</p>
    </div>
  );
}
