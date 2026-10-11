import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { createReviewedDrawingPdf, inspectPdfDrawing, validatePdfUpload } from "./pdf-review";

async function sampleElectricalDrawing() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([1190.55, 841.89]);
  page.drawText("CALDRIVA ELECTRICAL A3 SAMPLE", { x: 42, y: 792, size: 18, font, color: rgb(0.05, 0.125, 0.196) });
  page.drawLine({ start: { x: 42, y: 420 }, end: { x: 1148, y: 420 }, thickness: 1, color: rgb(0, 0, 0) });
  return doc.save();
}

describe("PDF drawing review", () => {
  it("inspects page count and A3 landscape size", async () => {
    const pdf = await sampleElectricalDrawing();
    const pages = await inspectPdfDrawing(pdf);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ page: 1, paper: "A3", orientation: "landscape" });
    expect(pages[0].widthMm).toBeCloseTo(420, 0);
    expect(pages[0].heightMm).toBeCloseTo(297, 0);
  });

  it("appends a review summary page without rasterizing original pages", async () => {
    const pdf = await sampleElectricalDrawing();
    const reviewed = await createReviewedDrawingPdf(pdf, {
      fileName: "electrical-a3-sample.pdf",
      revision: "P01",
      status: "reviewed_with_comments",
      reviewer: "Caldriva reviewer",
      reviewedAt: "2026-10-11T00:00:00.000Z",
      comments: [{ id: "c1", page: 1, xPercent: 50, yPercent: 50, text: "Confirm circuit reference.", author: "Caldriva reviewer", createdAt: "2026-10-11T00:00:00.000Z" }],
    });
    const loaded = await PDFDocument.load(reviewed);
    expect(loaded.getPageCount()).toBe(2);
    expect(loaded.getTitle()).toContain("Caldriva drawing review");
  });

  it("validates PDF upload limits", () => {
    expect(validatePdfUpload({ name: "drawing.pdf", type: "application/pdf", size: 1000 })).toBeNull();
    expect(validatePdfUpload({ name: "drawing.png", type: "image/png", size: 1000 })).toContain("Only PDF");
    expect(validatePdfUpload({ name: "drawing.pdf", type: "application/pdf", size: 20_000_000 })).toContain("10 MB");
  });
});
