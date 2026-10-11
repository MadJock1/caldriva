import { SolarStudio } from "@/components/simulator/solar-studio";
import { Suspense } from "react";
import Link from "next/link";
import { loadBuilding } from "@/app/dashboard/buildings/actions";
import { loadSimulation } from "@/app/dashboard/simulations/actions";
export const metadata = { title: "Building Studio · Solar" };
async function StudioContent({ searchParams }: { searchParams: Promise<{ building?: string; simulation?: string }> }) {
  const { building, simulation } = await searchParams;
  if (simulation) {
    const response = await loadSimulation(simulation);
    if (!response.data) return <section className="container py-20"><h1 className="text-3xl">Saved scenario unavailable</h1><p role="alert" className="mt-5">{response.error}</p><Link className="underline inline-block mt-5" href="/login">Sign in</Link></section>;
    const s = response.data;
    return <SolarStudio key={s.id} cloudDraft={{ draft: s.snapshot.building, identity: { id: s.building_id, version: s.building_version } }} initialScenario={s.snapshot} />;
  }
  if (!building) return <SolarStudio />;
  const response = await loadBuilding(building);
  if (response.error || !response.data) return <section className="container py-20"><h1 className="text-3xl">Cloud building unavailable</h1><p role="alert" className="mt-5">{response.error}</p><div className="flex gap-5 mt-7"><Link className="underline" href="/login">Sign in</Link><Link className="underline" href="/tools/solar">Open local studio</Link></div></section>;
  return <SolarStudio key={`${response.data.identity.id}:${response.data.identity.version}`} cloudDraft={response.data} />;
}
export default function SolarPage({ searchParams }: { searchParams: Promise<{ building?: string; simulation?: string }> }) { return <Suspense fallback={<p role="status" className="container py-20">Loading Building Studio…</p>}><StudioContent searchParams={searchParams} /></Suspense>; }
