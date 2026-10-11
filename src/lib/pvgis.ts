import { capacity, ENGINE_VERSION, pvgisAspect, pvgisSchema, solarInputSchema, type SolarInput, type SolarResult } from "./solar";

let windowStart = Date.now(), requestCount = 0;
export async function calculateSolar(input: SolarInput): Promise<SolarResult> {
  solarInputSchema.parse(input);
  if (Date.now() - windowStart > 60000) { windowStart = Date.now(); requestCount = 0; }
  if (++requestCount > 30) throw new Error("PVGIS request limit reached. Retry in a minute.");
  const capacityKwp = capacity(input);
  const url = new URL("https://re.jrc.ec.europa.eu/api/v5_3/PVcalc");
  url.search = new URLSearchParams({ lat: String(input.latitude), lon: String(input.longitude), peakpower: String(capacityKwp), loss: String(input.losses), angle: String(input.tilt), aspect: String(pvgisAspect(input.azimuth)), mountingplace: input.mounting, pvtechchoice: "crystSi", outputformat: "json", usehorizon: "1" }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(25000), cache: "no-store" });
  if (!response.ok) throw new Error("PVGIS could not calculate this site. Check coverage and coordinates, or retry later.");
  const parsed = pvgisSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("PVGIS returned an unexpected response. No estimate was generated.");
  const annualKwh = parsed.data.outputs.totals.fixed.E_y;
  return { annualKwh, capacityKwp, specificYield: annualKwh / capacityKwp, monthly: parsed.data.outputs.monthly.fixed.sort((a, b) => a.month - b.month), database: parsed.data.inputs.meteo_data.radiation_db, source: "European Commission JRC PVGIS 5.3", calculatedAt: new Date().toISOString(), engineVersion: ENGINE_VERSION };
}
