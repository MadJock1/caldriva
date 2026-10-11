import { Suspense } from "react";
import Link from "next/link";
import { ElectricalStudio } from "@/components/electrical/electrical-studio";
import { loadElectricalDesign } from "@/app/dashboard/electrical/actions";

export const metadata = { title: "Auto Electrical Design Studio" };

async function StudioContent({ searchParams }: { searchParams: Promise<{ design?: string }> }) {
  const { design } = await searchParams;
  if (!design) return <ElectricalStudio />;
  const response = await loadElectricalDesign(design);
  if (response.error || !response.data) {
    return (
      <section className="container py-20">
        <h1 className="text-3xl">Cloud design unavailable</h1>
        <p role="alert" className="mt-5">{response.error}</p>
        <div className="flex gap-5 mt-7">
          <Link className="underline" href="/login">Sign in</Link>
          <Link className="underline" href="/tools/electrical">Open local studio</Link>
        </div>
      </section>
    );
  }
  return <ElectricalStudio key={`${response.data.identity.id}:${response.data.identity.version}`} cloudDraft={response.data} />;
}

export default function ElectricalPage({ searchParams }: { searchParams: Promise<{ design?: string }> }) {
  return <Suspense fallback={<p role="status" className="container py-20">Loading Auto Electrical Design Studio…</p>}><StudioContent searchParams={searchParams} /></Suspense>;
}
