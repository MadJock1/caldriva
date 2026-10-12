import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { serverSupabase } from "@/lib/supabase/server";
import { listElectricalDesigns } from "./actions";
import { signOut } from "@/app/auth/actions";
import { CloudElectricalDesigns } from "@/components/electrical/cloud-designs";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

async function CustomerDesigns() {
  const client = await serverSupabase();
  if (!client) redirect("/login");
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect("/login");
  const designs = await listElectricalDesigns();
  return (
    <section className="container py-12">
      <div className="flex flex-wrap gap-5 justify-between">
        <div>
          <Logo variant="horizontal" size="sm" className="mb-3" />
          <p className="text-sm text-text-muted">Customer workspace</p>
          <h1 className="text-3xl font-semibold mt-2">Your electrical designs</h1>
          <p className="mt-3 break-all">{data.user.email}</p>
        </div>
        <form action={signOut}><Button variant="outline" type="submit">Sign out</Button></form>
      </div>
      {designs.error ? <p role="alert" className="mt-8">{designs.error}</p> : <CloudElectricalDesigns initial={designs.data ?? []} />}
    </section>
  );
}

export default function ElectricalDesignsPage() {
  return (
    <>
      <nav className="container pt-6 flex flex-wrap gap-5">
        <Link className="underline" href="/tools/electrical">Auto Electrical Design Studio →</Link>
        <Link className="underline" href="/dashboard/electrical/review">Professional review →</Link>
        <Link className="underline" href="/dashboard/buildings">Your buildings →</Link>
      </nav>
      <Suspense fallback={<p role="status" className="container py-20">Loading your workspace…</p>}><CustomerDesigns /></Suspense>
    </>
  );
}
