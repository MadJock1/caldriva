"use client";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { DISCIPLINES } from "@/lib/quote";
import { submitQuoteRequest } from "@/app/dashboard/quotes/actions";

export default function QuotePage() {
  const [name, setName] = useState("");
  const [scope, setScope] = useState("");
  const [discipline, setDiscipline] = useState<typeof DISCIPLINES[number]>("solar");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, start] = useTransition();
  const submit = () => start(async () => {
    try {
      const result = await submitQuoteRequest({ discipline, subject: name.trim(), message: scope.trim(), buildingId: null });
      if (result?.error) setMessage(result.error);
      else { setMessage("Your quotation request was saved to your account. An engineer can review it on the desk."); setSent(true); }
    } catch { setMessage("Submission failed. The draft brief below is still available."); }
  });
  return <section className="container py-20 max-w-3xl"><h1 className="text-4xl font-semibold">Prepare your engineering brief</h1><p className="mt-5 text-text-muted">Sign in and submit to your account; an engineer reviews it on the enrolment desk. Until account configuration is live, nothing is sent to an engineer — use the draft brief for your records.</p>
    <form className="grid gap-6 mt-10" onSubmit={e => { e.preventDefault(); submit(); }}>
      <label className="block"><span className="mb-1.5 block text-sm font-medium text-text">Discipline</span><select className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text" value={discipline} onChange={e => setDiscipline(e.target.value as typeof DISCIPLINES[number])}>{DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}</select></label>
      <Input label="Project name" required maxLength={150} value={name} onChange={e => setName(e.target.value)} />
      <Textarea label="Scope, location, available drawings and deliverables" required maxLength={10000} rows={8} value={scope} onChange={e => setScope(e.target.value)} />
      <div className="flex flex-wrap gap-3 items-center"><Button type="submit" loading={busy}>Submit quotation request</Button><span className="text-sm text-text-muted">or</span><Button type="button" variant="outline" onClick={() => { const url = URL.createObjectURL(new Blob([`Discipline: ${discipline}\nProject: ${name}\n\nScope:\n${scope}\n\nStatus: Draft brief — not submitted`], { type: "text/plain" })); const a = document.createElement("a"); a.href = url; a.download = "engineering-brief.txt"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>Download draft brief</Button></div>
    </form>
    {message && <p role={sent ? "status" : "alert"} className="mt-6 border rounded-lg bg-surface p-4">{message} {sent && <Link className="underline" href="/dashboard/quotes">View your quotation requests →</Link>}</p>}
  </section>;
}