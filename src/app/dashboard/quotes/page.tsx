import { Suspense } from "react";
import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import { listQuoteRequests } from "./actions";
import { signOut } from "@/app/auth/actions";
import { QuoteBoard } from "@/components/quote/quote-board";
import { Button } from "@/components/ui/button";
import Link from "next/link";

async function CustomerQuotes() {
  const client = await serverSupabase();
  if (!client) redirect("/login");
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect("/login");
  const requests = await listQuoteRequests();
  return <section className="container py-12">
    <div className="flex flex-wrap gap-5 justify-between"><div><p className="text-sm text-text-muted">Customer workspace</p><h1 className="text-3xl font-semibold mt-2">Quotation requests</h1><p className="mt-3 break-all">{data.user.email}</p></div><div className="flex gap-3 items-center"><Link className="underline" href="/dashboard/buildings">Buildings</Link><Link className="underline" href="/dashboard/simulations">Scenarios</Link><form action={signOut}><Button variant="outline" type="submit">Sign out</Button></form></div></div>
    {requests.error ? <p role="alert" className="mt-8">{requests.error}</p> : <QuoteBoard initial={requests.data ?? []} />}
  </section>;
}
export default function QuotesPage() { return <Suspense fallback={<p role="status" className="container py-20">Loading quotations…</p>}><CustomerQuotes /></Suspense>; }