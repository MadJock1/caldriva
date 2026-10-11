import { notFound } from "next/navigation";
import Link from "next/link";
import { disciplines } from "@/lib/catalogue";
export function generateStaticParams() { return disciplines.map(d => ({ discipline: d.slug })); }
export default async function ServicePage({ params }: { params: Promise<{ discipline: string }> }) {
  const { discipline } = await params;
  const d = disciplines.find(d => d.slug === discipline);
  if (!d) notFound();
  return <section className="container py-20 max-w-4xl"><p className="text-text-muted">Engineering scope</p><h1 className="text-4xl font-semibold mt-4">{d.name}</h1><p className="text-xl mt-6">{d.description}</p><div className="bg-surface border rounded-xl p-8 mt-8"><h2 className="font-semibold text-xl">From brief to reviewed deliverables</h2><p className="mt-4 text-text-muted">Provide the site, intended use, available drawings, project stage and required deliverables. Applicable jurisdiction, design standards and professional review requirements must be agreed for each project. Automated estimates are never certified deliverables.</p><Link href={`/request-quote?service=${d.slug}`} className="inline-block underline mt-6">Prepare a project brief →</Link></div>{d.slug === "solar" ? <Link className="inline-block mt-8 underline" href="/tools/solar">Open the preliminary solar simulator →</Link> : <p className="mt-8 text-text-muted">Interactive calculations for this discipline are planned for a later phase.</p>}</section>;
}
