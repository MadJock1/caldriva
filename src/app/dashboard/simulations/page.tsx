import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { serverSupabase } from "@/lib/supabase/server";
import { listSimulations } from "./actions";
import { listBuildings } from "../buildings/actions";
import { SavedSimulations } from "@/components/simulator/saved-simulations";
async function Content({ searchParams }: { searchParams: Promise<{ building?: string }> }) {
  const client = await serverSupabase();
  if (!client) redirect("/login");
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect("/login");
  const { building } = await searchParams;
  const scenarios = building ? await listSimulations(building) : null;
  const buildings = !building ? await listBuildings() : null;
  return <section className="container py-12"><Link className="underline" href="/dashboard/buildings">← Your buildings</Link><h1 className="text-3xl font-semibold mt-6">Saved solar scenarios</h1>{building ? <><Link className="inline-block mt-4 underline" href={`/tools/solar?building=${building}`}>Open building</Link>{scenarios?.error ? <p role="alert" className="mt-5">{scenarios.error}</p> : <SavedSimulations initial={scenarios?.data ?? []} />}</> : <><p className="mt-4 text-text-muted">Select a building to compare its scenarios.</p>{buildings?.error && <p role="alert">{buildings.error}</p>}<ul className="mt-6 space-y-4">{buildings?.data?.map(b => <li key={b.id}><Link className="underline" href={`/dashboard/simulations?building=${b.id}`}>{b.name}</Link></li>)}</ul>{buildings?.data?.length === 0 && <p className="mt-5">Save a building in the studio to begin.</p>}</>}</section>;
}
export default function SimulationsPage(props: { searchParams: Promise<{ building?: string }> }) { return <Suspense fallback={<p role="status" className="container py-20">Loading simulations…</p>}><Content {...props} /></Suspense>; }
