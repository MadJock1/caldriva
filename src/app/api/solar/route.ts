import { solarInputSchema } from "@/lib/solar";
import { calculateSolar } from "@/lib/pvgis";

// Instance-wide upstream guard, not an identity-based or distributed production limiter.
let windowStart = Date.now();
let requests = 0;
export async function POST(request: Request) {
  if (Date.now() - windowStart > 60_000) { requests = 0; windowStart = Date.now(); }
  if (++requests > 30) return Response.json({ error: "Solar service is busy. Retry in one minute." }, { status: 429, headers: { "Retry-After": "60" } });
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "JSON required." }, { status: 415 });
  const text = await request.text();
  if (text.length > 4096) return Response.json({ error: "Request too large." }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(text); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = solarInputSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Check location, panel count, power, tilt, azimuth and losses." }, { status: 400 });
  try {
    const result = await calculateSolar(parsed.data);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "PVGIS is unavailable or timed out. Your inputs are preserved; please retry." }, { status: 502 });
  }
}
