import { Suspense } from "react";
import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import { roleSchema } from "@/lib/quote";
import { listOpenRequests, listAssignedRequests } from "./actions";
import { EngineerBoard } from "@/components/quote/engineer-board";

async function EngineerWorkspace() {
  const client = await serverSupabase();
  if (!client) redirect("/login");
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect("/login");
  const { data: profile } = await client.from("profiles").select("user_id,display_name,role").eq("user_id", data.user.id).maybeSingle();
  const parsed = roleSchema.safeParse(profile?.role);
  if (!parsed.success || parsed.data === "customer") redirect("/dashboard/buildings");
  const [open, mine] = await Promise.all([listOpenRequests(), listAssignedRequests()]);
  const failure = open.error ?? mine.error;
  if (failure) return <section className="container py-12"><h1 className="text-3xl font-semibold">Quotation desk</h1><p role="alert" className="mt-5">{failure}</p></section>;
  return <EngineerBoard open={open.data ?? []} mine={mine.data ?? []} staffId={data.user.id} role={parsed.data} />;
}
export default function EngineerPage() { return <Suspense fallback={<p role="status" className="container py-20">Loading the quotation desk…</p>}><EngineerWorkspace /></Suspense>; }