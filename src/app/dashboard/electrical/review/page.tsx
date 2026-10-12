import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { serverSupabase } from "@/lib/supabase/server";
import { roleSchema } from "@/lib/quote";
import { listElectricalDesigns } from "@/app/dashboard/electrical/actions";
import { loadReviewWorkspace } from "@/app/dashboard/electrical/review-actions";
import { ReviewWorkflow } from "@/components/electrical/review-workflow";
import { Logo } from "@/components/brand/logo";

async function Workspace() {
  const client = await serverSupabase();
  if (!client) redirect("/login");
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect("/login");
  const { data: profile } = await client.from("profiles").select("role").eq("user_id", data.user.id).maybeSingle();
  const role = roleSchema.safeParse(profile?.role);
  const [designs, workspace] = await Promise.all([listElectricalDesigns(), loadReviewWorkspace()]);
  if (workspace.error || !workspace.data) return (
    <section className="container py-12">
      <h1 className="text-3xl font-semibold">Professional review</h1>
      <p role="alert" className="mt-5">{workspace.error}</p>
    </section>
  );
  return (
    <section className="container py-12">
      <Logo variant="horizontal" size="sm" className="mb-3" />
      <p className="text-sm text-text-muted">Reviewer &amp; audit workspace</p>
      <h1 className="text-3xl font-semibold mt-2">Professional review</h1>
      <p className="mt-3 text-text-muted break-all">{data.user.email}</p>
      <ReviewWorkflow
        userId={data.user.id}
        role={role.success ? role.data : "customer"}
        designs={designs.data ?? []}
        initial={workspace.data}
      />
    </section>
  );
}

export default function ReviewPage() {
  return (
    <>
      <nav className="container pt-6 flex flex-wrap gap-5">
        <Link className="underline" href="/dashboard/electrical">Your electrical designs →</Link>
        <Link className="underline" href="/tools/electrical">Auto Electrical Design Studio →</Link>
      </nav>
      <Suspense fallback={<p role="status" className="container py-20">Loading the review workspace…</p>}><Workspace /></Suspense>
    </>
  );
}
