import { Suspense } from "react";
import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import { listBuildings } from "./actions";
import { signOut } from "@/app/auth/actions";
import { CloudBuildings } from "@/components/building/cloud-buildings";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import Link from "next/link";

async function CustomerBuildings() {
  const client = await serverSupabase();
  if (!client) redirect("/login");
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect("/login");
  const buildings = await listBuildings();
  return <section className="container py-12"><div className="flex flex-wrap gap-5 justify-between"><div><Logo variant="horizontal" size="sm" className="mb-3" /><p className="text-sm text-text-muted">Customer workspace</p><h1 className="text-3xl font-semibold mt-2">Your buildings</h1><p className="mt-3 break-all">{data.user.email}</p></div><form action={signOut}><Button variant="outline" type="submit">Sign out</Button></form></div>{buildings.error ? <p role="alert" className="mt-8">{buildings.error}</p> : <CloudBuildings initial={buildings.data ?? []} />}</section>;
}
export default function BuildingsPage() { return <><nav className="container pt-6 flex flex-wrap gap-5"><Link className="underline" href="/dashboard/simulations">Saved solar scenarios →</Link><Link className="underline" href="/dashboard/quotes">Quotation requests →</Link><Link className="underline" href="/dashboard/engineer">Engineer desk →</Link></nav><Suspense fallback={<p role="status" className="container py-20">Loading your workspace…</p>}><CustomerBuildings /></Suspense></>; }
