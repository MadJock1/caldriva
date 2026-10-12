import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";
import { brand } from "../../brand";
import { complianceRevisionSchema } from "./revisions";

// Phase 6: white, print-friendly PDF compliance screening report.
// White background and dark text for ordinary printers, unlike the dark drawing-review
// sheet. The report reproduces a frozen revision snapshot; it never asserts approval.

export const complianceReportRequestSchema = z.object({
  revision: complianceRevisionSchema,
  currentFingerprint: z.string().max(64).nullable().default(null),
});
export type ComplianceReportRequest = z.infer<typeof complianceReportRequestSchema>;

type TextColor = ReturnType<typeof rgb>;

export async function generateComplianceReport(raw: ComplianceReportRequest): Promise<Uint8Array> {
  const { revision, currentFingerprint } = complianceReportRequestSchema.parse(raw);
  const document = await PDFDocument.create();
  document.setTitle(`${brand.name} - Compliance screening record ${revision.id}`);
  document.setAuthor(`${brand.name} ${brand.descriptor}`);
  document.setSubject("Automated compliance screening record - not a certificate or professional approval");
  document.setProducer("Caldriva Standards & Compliance");

  const normal = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.12, 0.15);
  const gray = rgb(0.4, 0.44, 0.48);
  const rule = rgb(0.8, 0.82, 0.85);
  const blue = rgb(0.11, 0.33, 0.72);
  const staleColor = rgb(0.6, 0.32, 0.02);
  const statusColor: Record<string, TextColor> = {
    PASS: rgb(0.09, 0.5, 0.28),
    FAIL: rgb(0.7, 0.1, 0.12),
    WARNING: rgb(0.66, 0.38, 0.02),
    "MISSING DATA": rgb(0.66, 0.38, 0.02),
    "NOT APPLICABLE": gray,
    "NOT EVALUATED": rgb(0.35, 0.32, 0.6),
    "REQUIRES PROFESSIONAL REVIEW": rgb(0.35, 0.32, 0.6),
  };

  let page = document.addPage([595, 842]);
  let y = 792;
  const left = 50;
  const maxWidth = 495;

  const clean = (text: string) => [...text.replace(/[\r\n\t]+/g, " ")].map(char => {
    try { normal.encodeText(char); return char; } catch { return "?"; }
  }).join("");

  function next() { page = document.addPage([595, 842]); y = 792; }
  function wrap(text: string, size: number, font: typeof normal, color: TextColor, indent = 0) {
    const chars = [...clean(text)];
    let current = "";
    const emit = () => {
      if (y < 60) next();
      page.drawText(current, { x: left + indent, y, size, font, color });
      y -= size + 5;
    };
    for (const char of chars) {
      if (font.widthOfTextAtSize(current + char, size) > maxWidth - indent && current) { emit(); current = ""; }
      current += char;
    }
    if (current) emit();
  }
  function line(text: string, size = 10, isHeading = false) {
    if (y < 60) next();
    wrap(text, size, isHeading ? bold : normal, isHeading ? ink : gray);
  }
  function heading(text: string) {
    y -= 10;
    if (y < 70) next();
    page.drawText(clean(text), { x: left, y, size: 13, font: bold, color: blue });
    y -= 6;
    page.drawLine({ start: { x: left, y }, end: { x: left + maxWidth, y }, thickness: 0.6, color: rule });
    y -= 14;
  }
  function pair(label: string, value: string) {
    if (y < 60) next();
    page.drawText(clean(label), { x: left, y, size: 9.5, font: bold, color: ink });
    page.drawText(clean(value), { x: left + 165, y, size: 9.5, font: normal, color: gray });
    y -= 15;
  }

  // Title block.
  page.drawText(clean(`${brand.name} / ${brand.descriptor}`), { x: left, y, size: 16, font: bold, color: ink });
  y -= 20;
  page.drawText("Compliance screening record", { x: left, y, size: 13, font: bold, color: blue });
  y -= 22;

  // Disclaimer box.
  const disclaimerLines = wrapCount(clean(revision.disclaimer), normal, 9, maxWidth - 20);
  const boxHeight = 16 + disclaimerLines.length * 12;
  if (y - boxHeight < 60) next();
  page.drawRectangle({ x: left, y: y - boxHeight, width: maxWidth, height: boxHeight, borderColor: ink, borderWidth: 0.8, color: rgb(0.965, 0.968, 0.972) });
  let dy = y - 14;
  for (const text of disclaimerLines) { page.drawText(text, { x: left + 10, y: dy, size: 9, font: bold, color: ink }); dy -= 12; }
  y -= boxHeight + 12;

  const stale = currentFingerprint !== null && currentFingerprint !== revision.fingerprint;
  if (currentFingerprint === null) {
    line("Staleness: NOT CHECKED - no current project fingerprint was supplied with this export.", 9.5);
  } else if (stale) {
    if (y < 60) next();
    page.drawText(clean("STALE: the project has changed since this revision. Regenerate the evaluation before relying on it."), { x: left, y, size: 9.5, font: bold, color: staleColor });
    y -= 15;
  } else {
    line("Staleness: CURRENT - the exported revision matches the current project fingerprint.", 9.5);
  }
  y -= 4;

  heading("Revision");
  pair("Revision", `${revision.revisionNumber} (${revision.id})`);
  pair("Created at", revision.createdAt);
  pair("Created by", revision.createdBy || "Not recorded");
  pair("Content fingerprint", revision.fingerprint);
  pair("Registry baseline", revision.registryVersion);
  pair("Engine version", revision.engineVersion);
  pair("Category", revision.category ?? "Not classified");
  pair("Jurisdiction", revision.jurisdiction ?? "Not confirmed");
  pair("Professional approval", "NOT ASSESSED");

  heading("Check status summary");
  const count = revision.counts;
  line(`Pass ${count.pass} · Fail ${count.fail} · Warning ${count.warning} · Missing data ${count.missingData} · Not applicable ${count.notApplicable} · Not evaluated ${count.notEvaluated} · Requires professional review ${count.requiresProfessionalReview}`);

  heading("Implemented checks");
  for (const check of revision.checks) {
    if (y < 60) next();
    page.drawText(clean(check.status), { x: left, y, size: 8.5, font: bold, color: statusColor[check.status] ?? gray });
    page.drawText(clean(`${check.title}`), { x: left + 150, y, size: 9, font: normal, color: ink });
    y -= 12;
    page.drawText(clean(`${check.reference}${check.edition ? ` · ed. ${check.edition}` : ""}`), { x: left + 150, y, size: 7.5, font: normal, color: gray });
    y -= 14;
  }

  heading("Applicability screening (candidates, not legal applicability)");
  for (const row of revision.matrix) {
    if (y < 60) next();
    page.drawText(clean(row.status), { x: left, y, size: 8.5, font: bold, color: statusColor[row.status] ?? gray });
    page.drawText(clean(row.identifier), { x: left + 150, y, size: 9, font: normal, color: ink });
    y -= 14;
  }

  heading("Calculation evidence (existing load engine)");
  line(`Estimated current: ${revision.calculations.currentA.toFixed(2)} A (engine ${revision.calculations.engineVersion}).`);
  line(`Estimated demand: ${revision.calculations.demandVA.toFixed(0)} VA. Mathematical result only; no cable or protective device is selected.`);

  heading("Limitations");
  line("No normative numerical thresholds are implemented in these phases. Cable sizing, disconnection, thermal withstand, selectivity and assembly/machinery verification remain open. Reviewer status is always UNREVIEWED. This record verifies software behaviour, not installation conformity.");

  // Footer on every page.
  const pages = document.getPages();
  pages.forEach((p, index) => {
    p.drawLine({ start: { x: left, y: 42 }, end: { x: left + maxWidth, y: 42 }, thickness: 0.5, color: rule });
    p.drawText(clean(`${revision.id} | fingerprint ${revision.fingerprint} | Not a certificate or professional approval | ${index + 1}/${pages.length}`), { x: left, y: 27, size: 7.5, font: normal, color: gray });
  });

  return document.save();
}

function wrapCount(text: string, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number, maxWidth: number): string[] {
  const chars = [...text];
  const lines: string[] = [];
  let current = "";
  for (const char of chars) {
    if (font.widthOfTextAtSize(current + char, size) > maxWidth && current) { lines.push(current); current = ""; }
    current += char;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}
