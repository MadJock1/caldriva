import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";

export const REVIEW_PDF_MAX_BYTES = 10_485_760;

export const drawingStatusSchema = z.enum([
  "draft",
  "for_review",
  "reviewed_with_comments",
  "approved_for_design_coordination",
  "rejected",
]);
export type DrawingStatus = z.infer<typeof drawingStatusSchema>;

export const drawingReviewCommentSchema = z.object({
  id: z.string().min(1).max(80),
  page: z.number().int().positive(),
  xPercent: z.number().min(0).max(100),
  yPercent: z.number().min(0).max(100),
  text: z.string().min(1).max(1000),
  author: z.string().min(1).max(120),
  createdAt: z.string().datetime(),
});
export type DrawingReviewComment = z.infer<typeof drawingReviewCommentSchema>;

export const reviewedDrawingMetadataSchema = z.object({
  fileName: z.string().min(1).max(255),
  revision: z.string().min(1).max(40),
  status: drawingStatusSchema,
  reviewer: z.string().min(1).max(120),
  reviewedAt: z.string().datetime(),
  comments: z.array(drawingReviewCommentSchema).max(500),
});
export type ReviewedDrawingMetadata = z.infer<typeof reviewedDrawingMetadataSchema>;

export interface PdfPageInfo {
  page: number;
  widthPt: number;
  heightPt: number;
  widthMm: number;
  heightMm: number;
  paper: string;
  orientation: "portrait" | "landscape";
}

const PAPER_SIZES_MM = [
  { name: "A0", width: 841, height: 1189 },
  { name: "A1", width: 594, height: 841 },
  { name: "A2", width: 420, height: 594 },
  { name: "A3", width: 297, height: 420 },
  { name: "A4", width: 210, height: 297 },
] as const;

export async function inspectPdfDrawing(bytes: Uint8Array | ArrayBuffer): Promise<PdfPageInfo[]> {
  const document = await PDFDocument.load(bytes, { ignoreEncryption: false });
  return document.getPages().map((page, index) => {
    const { width, height } = page.getSize();
    const widthMm = pointsToMm(width);
    const heightMm = pointsToMm(height);
    return {
      page: index + 1,
      widthPt: width,
      heightPt: height,
      widthMm,
      heightMm,
      paper: detectPaperSize(widthMm, heightMm),
      orientation: width >= height ? "landscape" : "portrait",
    };
  });
}

export async function createReviewedDrawingPdf(bytes: Uint8Array | ArrayBuffer, rawMetadata: ReviewedDrawingMetadata): Promise<Uint8Array> {
  const metadata = reviewedDrawingMetadataSchema.parse(rawMetadata);
  const source = await PDFDocument.load(bytes, { ignoreEncryption: false });
  const output = await PDFDocument.create();
  const copiedPages = await output.copyPages(source, source.getPageIndices());
  copiedPages.forEach((page) => output.addPage(page));

  output.setTitle(`${metadata.fileName} - Caldriva drawing review`);
  output.setAuthor("CALDRIVA ENGINEERING & TECHNOLOGY");
  output.setSubject(`Drawing review ${metadata.revision} / ${metadata.status}`);
  output.setKeywords(["Caldriva", "Electrical CAD", "Drawing Review", metadata.status]);
  output.setProducer("Caldriva Electrical CAD Pro");

  const normal = await output.embedFont(StandardFonts.Helvetica);
  const bold = await output.embedFont(StandardFonts.HelveticaBold);
  const page = output.addPage([595.28, 841.89]);
  const navy = rgb(0.05, 0.125, 0.196);
  const gray = rgb(0.28, 0.33, 0.39);
  const blue = rgb(0.15, 0.39, 0.92);
  let y = 792;

  const line = (text: string, size = 10, heading = false) => {
    const font = heading ? bold : normal;
    const maxWidth = 495;
    const clean = sanitizePdfText(text);
    let current = "";
    const emit = () => {
      if (y < 58) return;
      page.drawText(current, { x: 50, y, size, font, color: heading ? navy : gray });
      y -= size + 6;
    };
    for (const char of clean) {
      if (font.widthOfTextAtSize(current + char, size) > maxWidth && current) {
        emit();
        current = "";
      }
      current += char;
    }
    if (current) emit();
  };

  page.drawText("CALDRIVA ENGINEERING & TECHNOLOGY", { x: 50, y, size: 16, font: bold, color: navy });
  y -= 28;
  page.drawText("Electrical Drawing Review Record", { x: 50, y, size: 13, font: bold, color: blue });
  y -= 30;
  line(`File: ${metadata.fileName}`, 10, true);
  line(`Revision: ${metadata.revision}`);
  line(`Status: ${metadata.status}`);
  line(`Reviewer: ${metadata.reviewer}`);
  line(`Reviewed at: ${metadata.reviewedAt}`);
  line(`Original pages preserved: ${source.getPageCount()}`);
  y -= 12;
  line("Engineering comments", 12, true);

  if (metadata.comments.length === 0) {
    line("No comments recorded in this review session.");
  } else {
    for (const comment of metadata.comments) {
      line(`P${comment.page} @ ${comment.xPercent.toFixed(1)}%, ${comment.yPercent.toFixed(1)}% - ${comment.author}: ${comment.text}`);
    }
  }

  page.drawLine({ start: { x: 50, y: 42 }, end: { x: 545, y: 42 }, thickness: 0.5, color: gray });
  page.drawText("Review page appended by Caldriva. Original drawing pages are copied as PDF pages and are not rasterized by this operation.", { x: 50, y: 27, size: 7.5, font: normal, color: gray });

  return output.save();
}

export function validatePdfUpload(file: { type: string; size: number; name: string }) {
  if (file.type !== "application/pdf") return "Only PDF drawings can be opened in Drawing Review.";
  if (file.size <= 0) return "The selected PDF is empty.";
  if (file.size > REVIEW_PDF_MAX_BYTES) return "PDF drawings must be 10 MB or smaller for browser review.";
  if (!file.name.toLowerCase().endsWith(".pdf")) return "The selected drawing must use a .pdf file name.";
  return null;
}

function pointsToMm(points: number) {
  return Math.round((points * 25.4 / 72) * 10) / 10;
}

function detectPaperSize(widthMm: number, heightMm: number) {
  const shortSide = Math.min(widthMm, heightMm);
  const longSide = Math.max(widthMm, heightMm);
  const match = PAPER_SIZES_MM.find((paper) => Math.abs(shortSide - paper.width) <= 3 && Math.abs(longSide - paper.height) <= 3);
  return match?.name ?? "Custom";
}

function sanitizePdfText(value: string) {
  return value.replace(/[\r\n\t]/g, " ").replace(/[^\x20-\x7E]/g, "?");
}
