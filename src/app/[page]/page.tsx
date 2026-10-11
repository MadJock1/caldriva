import { notFound } from "next/navigation";
const content: Record<string, [string, string]> = {
  about: ["Engineering clarity, from the start.", "Caldriva is a working brand for a remotely operated engineering platform based in Portugal, initially focused on European building projects. The platform is in development. Verified professional credentials and company contact details will be published when supplied."],
  "how-it-works": ["Locate. Model. Simulate. Review.", "Open Building Studio, set the location, draw or enter roof geometry, confirm pitch and azimuth, then request a PVGIS estimate. Save a draft in this browser, or to your account when Supabase is configured. Engineer assignment and deliverable review are planned next."],
  contact: ["Contact", "Company email, telephone and legal entity details have not yet been configured. Online enquiries are not currently submitted. Use the project brief page to prepare your requirements."],
  privacy: ["Privacy notice — draft", "The studio can store a building draft in your browser when you choose Save local draft. When Supabase is configured, registration sends your email and credentials to Supabase Auth, and Save to account stores building inputs in the configured database. Account sessions use cookies. You can delete cloud buildings from your dashboard and local drafts from the studio. Map requests go to OpenStreetMap; solar requests send coordinates and system parameters to European Commission PVGIS. A complete GDPR notice, controller identity, database region, retention schedule and rights contact must be supplied before public deployment."],
  terms: ["Terms — draft", "All automated outputs are preliminary estimates, not construction instructions or professional approval. Financial assumptions are user-supplied scenarios. These draft terms require legal review and company information before public deployment."],
};
export function generateStaticParams() { return Object.keys(content).map(page => ({ page })); }
export const instant = false;
export default async function InformationPage({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  const entry = content[page];
  if (!entry) notFound();
  return <section className="container py-24 max-w-3xl"><h1 className="text-4xl font-semibold">{entry[0]}</h1><p className="text-lg leading-relaxed mt-8 text-text-muted">{entry[1]}</p></section>;
}
