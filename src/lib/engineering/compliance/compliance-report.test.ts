import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { exampleProjects } from "../verification/examples";
import { complianceFingerprint, createComplianceRevision } from "./revisions";
import { complianceReportRequestSchema, generateComplianceReport } from "./compliance-report";

describe("print-friendly compliance PDF report", () => {
  it("renders a loadable PDF even when few checks are populated", async () => {
    const revision = createComplianceRevision(exampleProjects().C, { revisionNumber: 1, createdBy: "Reviewer" });
    const bytes = await generateComplianceReport({ revision, currentFingerprint: null });
    expect(bytes.length).toBeGreaterThan(500);
    expect(Buffer.from(bytes.slice(0, 5)).toString("latin1")).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(pdf.getTitle()).toContain(revision.id);
  });

  it("renders a longer project across multiple checks and marks staleness input", async () => {
    const building = exampleProjects().B;
    const revision = createComplianceRevision(building, { revisionNumber: 2, createdBy: "Reviewer" });
    const current = await generateComplianceReport({ revision, currentFingerprint: complianceFingerprint(building) });
    const stale = await generateComplianceReport({ revision, currentFingerprint: "deadbeefdeadbeef" });
    expect((await PDFDocument.load(current)).getPageCount()).toBeGreaterThanOrEqual(1);
    expect((await PDFDocument.load(stale)).getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("rejects malformed report requests before rendering", () => {
    expect(complianceReportRequestSchema.safeParse({ revision: { revisionNumber: 1 } }).success).toBe(false);
    expect(complianceReportRequestSchema.safeParse({}).success).toBe(false);
  });
});
