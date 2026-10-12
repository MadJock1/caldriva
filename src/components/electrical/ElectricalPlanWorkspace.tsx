"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { PlanEditor } from "./plan-editor";
import { electricalBuildingSchema, emptyBuilding, parseElectricalBuildingDraft, type ElectricalBuilding } from "@/lib/electrical";

const STORAGE_KEY = "caldriva-electrical-v1";

export function ElectricalPlanWorkspace() {
  const [building, setBuilding] = useState<ElectricalBuilding>(() => {
    if (typeof window === "undefined") return emptyBuilding();
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? parseElectricalBuildingDraft(JSON.parse(saved)) : emptyBuilding();
    } catch {
      return emptyBuilding();
    }
  });
  const [message, setMessage] = useState("Local plan workspace. Save persists only in this browser.");

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(electricalBuildingSchema.parse(building)));
      setMessage("Electrical plan saved locally.");
    } catch {
      setMessage("Could not save this plan. Existing saved data was not changed.");
    }
  }

  return <main className="fixed inset-0 z-[1100] flex min-h-screen flex-col overflow-hidden bg-background text-text-primary">
    <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <Logo variant="horizontal" size="sm" />
        <div className="min-w-0 border-l border-border pl-3">
          <p className="truncate text-xs uppercase tracking-wider text-text-muted">Electrical CAD workspace</p>
          <h1 className="truncate text-sm font-semibold">{building.name || "Untitled electrical drawing"}</h1>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="hidden text-xs text-text-muted lg:inline">{message}</span>
        <Button size="sm" variant="outline" onClick={save}>Save</Button>
        <Link className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs hover:bg-background" href="/tools/electrical">Workflow</Link>
        <Link className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs hover:bg-background" href="/dashboard">Dashboard</Link>
      </div>
    </header>
    <section className="min-h-0 flex-1 overflow-hidden"><PlanEditor building={building} onChange={setBuilding} /></section>
  </main>;
}
