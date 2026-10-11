"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { SimulationSnapshot } from "@/lib/simulation";
export function ReportDownload({ snapshot }: { snapshot: SimulationSnapshot }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function download() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/reports/solar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snapshot), signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error("Report could not be generated. Check inputs and try again.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "preliminary-solar-report.pdf"; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : "Report failed."); }
    finally { setBusy(false); }
  }
  return <div><Button variant="outline" loading={busy} onClick={download}>Download preliminary PDF</Button>{error && <p role="alert" className="mt-2">{error}</p>}</div>;
}
