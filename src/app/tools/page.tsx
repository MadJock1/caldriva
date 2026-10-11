import Link from "next/link";
import { disciplines } from "@/lib/catalogue";
const available = new Set(["solar", "electrical"]);
export default function ToolsPage() {
  return <section className="container py-20"><h1 className="text-4xl font-semibold">Engineering tools</h1><p className="text-text-muted mt-5">Preliminary calculations with visible assumptions. No account needed.</p><div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">{disciplines.map(d => <article key={d.slug} className="border rounded-xl p-7 bg-surface"><p className="text-sm text-text-muted">{available.has(d.slug) ? "Available module" : "Planned"}</p><h2 className="text-xl font-semibold mt-5">{d.name}</h2><p className="text-text-muted mt-3">{d.description}</p>{d.slug === "solar" && <Link href="/tools/solar" className="inline-block mt-6 underline">Open Building Studio →</Link>}{d.slug === "electrical" && <Link href="/tools/electrical" className="inline-block mt-6 underline">Open Electrical Studio →</Link>}</article>)}</div></section>;
}
