import { notFound } from "next/navigation";
import Link from "next/link";
import { disciplines } from "@/lib/catalogue";
export function generateStaticParams() { return ["electrical", "hvac", "plumbing", "hydraulics", "pneumatics"].map(discipline => ({ discipline })); }
export default async function PlannedToolPage({ params }: { params: Promise<{ discipline: string }> }) {
  const { discipline } = await params;
  const entry = disciplines.find(d => d.slug === (discipline === "pneumatics" ? "industrial" : discipline));
  if (!entry || entry.slug === "solar") notFound();
  return <section className="container py-20 max-w-3xl"><p className="text-text-muted">Planned module</p><h1 className="text-4xl font-semibold mt-4">{entry.name}</h1><p className="text-lg text-text-muted mt-6">{entry.description} This calculator is not yet implemented. Solar is the first available engineering module.</p><Link className="inline-block underline mt-8" href="/tools/solar">Explore solar Building Studio →</Link></section>;
}
