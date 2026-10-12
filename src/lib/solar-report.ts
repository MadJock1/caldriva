import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createHash } from "node:crypto";
import { brand } from "./brand";
import { logoMark } from "./logo";
import { assumptions, snapshotSchema, panelModelFromSelection, type SimulationSnapshot } from "./simulation";
import { financialScenario } from "./solar";
import { horizontalRoofArea } from "./building";
import { layoutPanels } from "./panel-layout";

export async function generateSolarReport(raw: SimulationSnapshot) {
  const s = snapshotSchema.parse(raw);
  const document = await PDFDocument.create();
  document.setTitle(`${brand.name} - Preliminary solar PV report`);
  document.setAuthor(`${brand.name} ${brand.descriptor}`);
  document.setSubject("Preliminary automated estimate - not engineer-reviewed, certified or approved");
  const normal = await document.embedFont(StandardFonts.Helvetica), bold = await document.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(.05, .125, .196), teal = rgb(.12, .5, .46), gray = rgb(.3, .36, .4);
  let page = document.addPage([595, 842]), y = 790;
  function clean(text: string) { return [...text.replace(/[\r\n\t]/g, " ")].map(c => { try { normal.encodeText(c); return c; } catch { return "?"; } }).join(""); }
  function next() { page = document.addPage([595, 842]); y = 790; }
  function line(text: string, size = 10, heading = false) {
    const font = heading ? bold : normal, maxWidth = 495;
    // Character-aware wrapping also bounds long unbroken site references.
    const chars = [...clean(text)]; let current = "";
    const emit = () => { if (y < 65) next(); page.drawText(current, { x: 50, y, size, font, color: heading ? navy : gray }); y -= size + 5; };
    for (const char of chars) { if (font.widthOfTextAtSize(current + char, size) > maxWidth && current) { emit(); current = ""; } current += char; }
    if (current) emit();
  }
  function heading(text: string) { y -= 12; line(text, 15, true); y -= 5; }
  const n = (v: number, dp = 2) => v.toLocaleString("en-GB", { maximumFractionDigits: dp });
  const blue = rgb(.31, .549, 1);
  // Draws the brand emblem from the approved vector geometry as a placed box of `target` pt.
  function drawEmblem(target: number, left: number, top: number, color: ReturnType<typeof rgb>) {
    const [mx0, my0, , my1] = logoMark.bounds;
    const s = target / (my1 - my0);
    page.drawSvgPath(logoMark.path, { x: left - s * mx0, y: top + s * my0, scale: s, color });
  }
  const reference = createHash("sha256").update(JSON.stringify(s)).digest("hex").slice(0, 12).toUpperCase();
  line(`${brand.name} / ${brand.descriptor}`, 18, true);
  line(brand.tagline, 10);
  drawEmblem(44, 501, 812, blue);
  heading("Preliminary solar PV report");
  line("PRELIMINARY AUTOMATED ESTIMATE - NOT CERTIFIED OR APPROVED", 10, true);
  line(`Reference: SOL-${reference} | Generated: ${new Date().toISOString()}`);
  line(`Scenario: ${s.name} | Calculated: ${s.result.calculatedAt}`);
  heading("Building and declared system");
  line(`Building: ${s.building.name}`);
  line(`Address / reference: ${s.building.address || "Not supplied"}`);
  const input = s.building.solar;
  line(`Coordinates: ${input.latitude}, ${input.longitude} | Horizontal roof area: ${n(horizontalRoofArea(s.building.roof))} m²`);
  line(`Provenance: ${s.building.provenance}`);
  line(`Panel model: ${s.panel.label} (${s.panel.panelModelId}) | ${s.panel.verified ? "VERIFIED SOURCE RECORD" : "UNVERIFIED - confirm against the datasheet"}`);
  line(`Module dimensions: ${s.panel.widthM} x ${s.panel.lengthM} m | ${s.panel.watts} Wp each | Layout count: ${s.panel.layoutCount} (${s.panel.countSource === "layout" ? "from layout" : "manual override"})`);
  line(`Energy model panels: ${input.panels} x ${input.panelWatts} Wp | Capacity: ${n(s.result.capacityKwp)} kWp`);
  line(`Tilt: ${input.tilt}° | Compass azimuth: ${input.azimuth}° | Mounting: ${input.mounting} | Losses: ${input.losses}%`);
  heading("Production estimates");
  line(`Annual energy: ${n(s.result.annualKwh)} kWh | Specific yield: ${n(s.result.specificYield)} kWh/kWp`, 12, true);
  line(`Declared source: ${s.result.source} | Dataset: ${s.result.database}`);
  line(`Calculation version: ${s.result.engineVersion} | Snapshot schema: ${s.schemaVersion} | Layout: metric-rectangles-v2`);
  line("This export reproduces a validated input/result snapshot. It is not independent authentication of the source data or professional review.");
  heading("Monthly energy (kWh)");
  if (y < 300) next();
  const chartBase = y - 155, max = Math.max(1, ...s.result.monthly.map(m => m.E_m));
  const monthly = [...s.result.monthly].sort((a, b) => a.month - b.month);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  monthly.forEach((m, i) => {
    const x = 50 + i * 41, height = m.E_m / max * 120;
    page.drawRectangle({ x, y: chartBase, width: 28, height, color: teal });
    page.drawText(months[m.month - 1], { x, y: chartBase - 15, size: 8, font: normal, color: navy });
    page.drawText(String(Math.round(m.E_m)), { x, y: chartBase + height + 5, size: 7, font: normal, color: navy });
  });
  y = chartBase - 40;
  next(); heading("Roof and preliminary panel layout");
  line(`Panel model: ${s.panel.label} (${s.panel.panelModelId}); ${s.panel.widthM} x ${s.panel.lengthM} m; ${s.panel.watts} Wp; ${s.panel.verified ? "verified record" : "UNVERIFIED - not a confirmed manufacturer record"}.`);
  line(`Arrangement ${s.layout.orientation}; setback ${s.layout.setback} m; gap ${s.layout.gap} m; layout capacity ${n(s.panel.layoutCount * s.panel.watts / 1000)} kWp.`);
  let layout;
  try { layout = layoutPanels(s.building.roof, panelModelFromSelection(s.panel), { orientation: s.layout.orientation, setback: s.layout.setback, gap: s.layout.gap }, input.azimuth, s.building.roofObstacles); } catch (e) { line(`Layout unavailable: ${e instanceof Error ? e.message : "invalid geometry"}`); }
  if (layout && layout.roof.length) {
    const [minX, minY, maxX, maxY] = layout.bounds;
    const scale = Math.min(470 / Math.max(1, maxX - minX), 250 / Math.max(1, maxY - minY));
    const bottom = y - 275;
    layout.roof.forEach((p, i) => {
      const q = layout.roof[(i + 1) % layout.roof.length];
      page.drawLine({ start: { x: 60 + (p[0] - minX) * scale, y: bottom + (p[1] - minY) * scale }, end: { x: 60 + (q[0] - minX) * scale, y: bottom + (q[1] - minY) * scale }, thickness: 1.4, color: navy });
    });
    layout.obstacles.forEach(obstacle => obstacle.forEach((p, i) => {
      const q = obstacle[(i + 1) % obstacle.length];
      page.drawLine({ start: { x: 60 + (p[0] - minX) * scale, y: bottom + (p[1] - minY) * scale }, end: { x: 60 + (q[0] - minX) * scale, y: bottom + (q[1] - minY) * scale }, thickness: 1, color: rgb(.7, .45, .05) });
    }));
    // Real panel rectangles drawn at the projected metric scale, not a schematic grid.
    layout.panels.forEach(panel => {
      const xs = panel.map(p => p[0]), ys = panel.map(p => p[1]);
      page.drawRectangle({ x: 60 + (Math.min(...xs) - minX) * scale, y: bottom + (Math.min(...ys) - minY) * scale, width: (Math.max(...xs) - Math.min(...xs)) * scale, height: (Math.max(...ys) - Math.min(...ys)) * scale, color: teal, opacity: .18, borderColor: teal, borderWidth: .5 });
    });
    y = bottom - 20;
    line(`Layout count: ${layout.count}; energy model count: ${input.panels}. Diagram aligned to input azimuth, not north-up.`);
    if (layout.count !== input.panels) line("COUNT MISMATCH: Production uses the declared panel count, not this layout count.", 10, true);
    line(layout.warning);
  } else line("No usable roof geometry supplied. A panel layout cannot be generated. The production estimate uses the manually declared panel count.");
  heading("Financial assumptions and annual balance");
  const f = s.building.finance, money = financialScenario(s.result.annualKwh, f);
  line(`Annual demand: ${n(f.consumption)} kWh | Assumed PV self-consumption: ${f.selfConsumption}%`);
  line(`Import tariff: EUR ${f.importTariff}/kWh | Export compensation: EUR ${f.exportTariff}/kWh`);
  line(`Installed cost: EUR ${n(f.capex)} | Annual maintenance: EUR ${n(f.annualOpex)}`);
  line(`Self-used: ${n(money.selfUsed)} kWh | Exported: ${n(money.exported)} kWh`);
  line(`Net annual savings: EUR ${n(money.netSavings)} | Simple payback: ${money.payback === null ? "No positive annual saving" : `${n(money.payback)} years`}`);
  heading("Methodology, assumptions and limitations");
  line("Capacity (kWp) = panel count x panel Wp / 1000. Compass azimuth is converted to PVGIS aspect by subtracting 180 degrees. PVGIS models production using the supplied location, inclination, mounting and system-loss inputs.");
  line("Self-used energy = min(annual production x assumed share, annual demand). Export = production - self-use. Net savings = self-use x import tariff + export x export tariff - maintenance. Simple payback = installed cost / positive net savings.");
  line("Roof area uses spherical GeoJSON area. The layout places real module rectangles at catalogue dimensions on a local horizontal metre projection with edge clearance. Pitch does not reconstruct 3D geometry. Obstacles and inter-row spacing for shading are not modelled.");
  for (const a of [...new Set([...assumptions, ...s.assumptions])]) { y -= 4; line(`- ${a}`); }
  line("Missing-data checks: roof pitch, roof structure, exact measurements, nearby shading, grid constraints and hourly demand require independent confirmation. Consult a qualified engineer before procurement, permitting or installation.");
  line("PDF font limitation: characters unsupported by the standard Latin font are rendered as '?'. The application retains the original text.", 8);
  document.getPages().forEach((p, index, pages) => {
    p.drawLine({ start: { x: 50, y: 42 }, end: { x: 545, y: 42 }, thickness: .5, color: gray });
    p.drawText(`SOL-${reference} | Preliminary - no professional approval | ${index + 1}/${pages.length}`, { x: 50, y: 27, font: normal, size: 8, color: gray });
  });
  return document.save();
}
