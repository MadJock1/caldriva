import { complianceReportRequestSchema, generateComplianceReport } from "@/lib/engineering/compliance/compliance-report";

let start = Date.now(), count = 0;
export async function POST(request: Request) {
  if (Date.now() - start > 60000) { start = Date.now(); count = 0; }
  if (++count > 30) return Response.json({ error: "Report service busy. Retry later." }, { status: 429 });
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "JSON required" }, { status: 415 });
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: "Missing body" }, { status: 400 });
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break;
      length += next.value.byteLength;
      if (length > 200000) { await reader.cancel(); return Response.json({ error: "Report input too large" }, { status: 413 }); }
      chunks.push(next.value);
    }
    const parsed = complianceReportRequestSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (!parsed.success) return Response.json({ error: "Invalid compliance revision" }, { status: 400 });
    const pdf = await generateComplianceReport(parsed.data);
    return new Response(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="compliance-${parsed.data.revision.id}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return Response.json({ error: "Report input could not be processed" }, { status: 400 }); }
}
