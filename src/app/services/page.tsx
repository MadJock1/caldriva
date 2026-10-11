import Link from "next/link";
import { disciplines } from "@/lib/catalogue";
export default function ServicesPage() {
  return <section className="container py-20"><h1 className="text-4xl font-semibold">Engineering services</h1><p className="mt-5 max-w-2xl text-text-muted">Explore project scopes across building and industrial systems. Professional services require scope confirmation, engineer qualification verification and a separate quotation.</p><div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">{disciplines.map(d => <Link href={`/services/${d.slug}`} key={d.slug} className="border bg-surface rounded-xl p-7"><h2 className="text-xl font-semibold">{d.name} →</h2><p className="mt-3 text-text-muted">{d.description}</p></Link>)}</div></section>;
}
