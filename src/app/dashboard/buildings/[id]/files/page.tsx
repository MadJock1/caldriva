import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { serverSupabase } from "@/lib/supabase/server";
import { listBuildingFiles } from "../../files-actions";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { BuildingFiles } from "@/components/building/building-files";

export const instant = false;

async function BuildingFilesWorkspace({ buildingId }: { buildingId: string }) {
  const client = await serverSupabase();
  if (!client) redirect("/login");
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect("/login");
  const building = await client.from("buildings").select("id,name").eq("id", buildingId).eq("owner_id", data.user.id).maybeSingle();
  if (building.error || !building.data) redirect("/dashboard/buildings");
  const files = await listBuildingFiles(buildingId);
  return <section className="container py-12">
    <div className="flex flex-wrap gap-5 justify-between">
      <div>
        <Link className="underline text-sm" href="/dashboard/buildings">← Back to your buildings</Link>
        <p className="text-sm text-text-muted mt-4">Building workspace</p>
        <h1 className="text-3xl font-semibold mt-2 break-words">{building.data.name}</h1>
        <p className="mt-3 text-text-muted">Private file storage for drawings, surveys and reports.</p>
      </div>
      <form action={signOut}><Button variant="outline" type="submit">Sign out</Button></form>
    </div>
    {files.error ? <p role="alert" className="mt-8">{files.error}</p> : <BuildingFiles buildingId={buildingId} initial={files.data ?? []} />}
  </section>;
}

export default async function BuildingFilesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense fallback={<p role="status" className="container py-20">Loading files…</p>}><BuildingFilesWorkspace buildingId={id} /></Suspense>;
}
