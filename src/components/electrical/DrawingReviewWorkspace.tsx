"use client";

import { useRef, useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Button } from "@/components/ui/button";
import {
  createReviewedDrawingPdf,
  inspectPdfDrawing,
  validatePdfUpload,
  type DrawingReviewComment,
  type DrawingStatus,
  type PdfPageInfo,
} from "@/lib/electrical";

const statuses: DrawingStatus[] = ["draft", "for_review", "reviewed_with_comments", "approved_for_design_coordination", "rejected"];

export function DrawingReviewWorkspace() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [objectUrl, setObjectUrl] = useState("");
  const [pages, setPages] = useState<PdfPageInfo[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [revision, setRevision] = useState("P01");
  const [status, setStatus] = useState<DrawingStatus>("for_review");
  const [reviewer, setReviewer] = useState("Caldriva reviewer");
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<DrawingReviewComment[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function openFile(file: File) {
    const validation = validatePdfUpload(file);
    if (validation) {
      setMessage(validation);
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const inspected = await inspectPdfDrawing(bytes);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setObjectUrl(URL.createObjectURL(new Blob([bytesToArrayBuffer(bytes)], { type: "application/pdf" })));
      setFileBytes(bytes);
      setFileName(file.name);
      setPages(inspected);
      setCurrentPage(1);
      setComments([]);
      setMessage(`Opened ${file.name}: ${inspected.length} page(s).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open this PDF drawing.");
    } finally {
      setBusy(false);
    }
  }

  async function openSample() {
    const bytes = await createSampleElectricalPdf();
    const file = new File([bytesToArrayBuffer(bytes)], "caldriva-electrical-a3-sample.pdf", { type: "application/pdf" });
    await openFile(file);
  }

  function addComment() {
    const text = commentText.trim();
    if (!text) {
      setMessage("Enter a review comment before adding it.");
      return;
    }
    const comment: DrawingReviewComment = {
      id: `comment-${Date.now().toString(36)}`,
      page: currentPage,
      xPercent: 50,
      yPercent: 50,
      text,
      author: reviewer.trim() || "Caldriva reviewer",
      createdAt: new Date().toISOString(),
    };
    setComments((items) => [...items, comment]);
    setCommentText("");
    setMessage("Comment added to the review record.");
  }

  async function downloadReviewedPdf() {
    if (!fileBytes || !fileName) {
      setMessage("Open a PDF drawing first.");
      return;
    }
    setBusy(true);
    try {
      const bytes = await createReviewedDrawingPdf(fileBytes, {
        fileName,
        revision,
        status,
        reviewer: reviewer.trim() || "Caldriva reviewer",
        reviewedAt: new Date().toISOString(),
        comments,
      });
      const url = URL.createObjectURL(new Blob([bytesToArrayBuffer(bytes)], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName.replace(/\.pdf$/i, `-${revision}-reviewed.pdf`);
      link.click();
      URL.revokeObjectURL(url);
      setMessage("Reviewed PDF downloaded. Original pages were copied as PDF pages and a review record was appended.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create reviewed PDF.");
    } finally {
      setBusy(false);
    }
  }

  const currentPageInfo = pages.find((page) => page.page === currentPage);

  return (
    <main className="min-h-screen bg-background text-text-primary">
      <div className="border-b border-border bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Caldriva Electrical CAD Pro</p>
            <h1 className="text-xl font-semibold">PDF Drawing Review</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void openFile(file); }} />
            <Button variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>Open PDF</Button>
            <Button variant="outline" disabled={busy} onClick={openSample}>Open A3 sample</Button>
            <Button disabled={busy || !fileBytes} onClick={downloadReviewedPdf}>Download reviewed PDF</Button>
          </div>
        </div>
      </div>

      <div className="grid h-[calc(100vh-74px)] grid-cols-[260px_1fr_320px] overflow-hidden">
        <aside className="overflow-auto border-r border-border bg-surface p-3">
          <h2 className="mb-3 text-sm font-semibold">Sheets</h2>
          {pages.length === 0 ? <p className="text-sm text-text-muted">Open a PDF drawing package or the A3 sample.</p> : <div className="space-y-2">
            {pages.map((page) => (
              <button key={page.page} className={`w-full rounded border p-3 text-left text-xs ${currentPage === page.page ? "border-primary bg-primary-muted" : "border-border bg-background"}`} onClick={() => setCurrentPage(page.page)}>
                <span className="block font-semibold text-text-primary">Sheet {page.page}</span>
                <span className="block text-text-muted">{page.paper} {page.orientation}</span>
                <span className="block text-text-muted">{page.widthMm} x {page.heightMm} mm</span>
              </button>
            ))}
          </div>}
        </aside>

        <section className="relative overflow-auto bg-[#20242c] p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="text-text-muted">
              {fileName || "No drawing opened"}{currentPageInfo ? ` / Sheet ${currentPageInfo.page} / ${currentPageInfo.paper}` : ""}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setZoom((value) => Math.max(0.5, value - 0.1))}>Zoom -</Button>
              <span className="font-mono text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
              <Button size="sm" variant="outline" onClick={() => setZoom((value) => Math.min(2.5, value + 0.1))}>Zoom +</Button>
            </div>
          </div>
          <div className="mx-auto origin-top rounded-lg bg-surface shadow-xl" style={{ width: `${Math.round(900 * zoom)}px`, height: `${Math.round(640 * zoom)}px` }}>
            {objectUrl ? (
              <object data={`${objectUrl}#page=${currentPage}`} type="application/pdf" className="h-full w-full rounded-lg" aria-label="PDF drawing sheet">
                <a className="underline" href={objectUrl} target="_blank" rel="noreferrer">Open PDF drawing in a new tab</a>
              </object>
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center text-text-muted">Open a PDF to inspect and review electrical drawing sheets.</div>
            )}
          </div>
        </section>

        <aside className="overflow-auto border-l border-border bg-surface p-3">
          <h2 className="mb-3 text-sm font-semibold">Review Record</h2>
          <div className="space-y-3 text-sm">
            <label className="block">Revision<input className="mt-1 w-full rounded border border-border bg-background px-3 py-2" value={revision} onChange={(event) => setRevision(event.target.value)} /></label>
            <label className="block">Status<select className="mt-1 w-full rounded border border-border bg-background px-3 py-2" value={status} onChange={(event) => setStatus(event.target.value as DrawingStatus)}>{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="block">Reviewer<input className="mt-1 w-full rounded border border-border bg-background px-3 py-2" value={reviewer} onChange={(event) => setReviewer(event.target.value)} /></label>
            <label className="block">Engineering comment<textarea className="mt-1 h-24 w-full rounded border border-border bg-background px-3 py-2" value={commentText} onChange={(event) => setCommentText(event.target.value)} /></label>
            <Button variant="outline" disabled={!fileBytes || busy} onClick={addComment}>Add comment to sheet {currentPage}</Button>
          </div>
          <p role="status" className="my-4 text-sm text-text-muted">{message}</p>
          <div className="space-y-2">
            {comments.map((comment) => <div key={comment.id} className="rounded border border-border bg-background p-3 text-xs"><strong>P{comment.page}</strong> {comment.text}<p className="mt-1 text-text-muted">{comment.author} / {comment.createdAt.slice(0, 10)}</p></div>)}
          </div>
        </aside>
      </div>
    </main>
  );
}

async function createSampleElectricalPdf() {
  const doc = await PDFDocument.create();
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([1190.55, 841.89]);
  const navy = rgb(0.05, 0.125, 0.196);
  const blue = rgb(0.15, 0.39, 0.92);
  const gray = rgb(0.28, 0.33, 0.39);
  page.drawText("CALDRIVA ENGINEERING & TECHNOLOGY", { x: 42, y: 792, size: 18, font: bold, color: navy });
  page.drawText("Electrical Floor Plan - A3 Sample", { x: 42, y: 764, size: 14, font: bold, color: blue });
  page.drawRectangle({ x: 42, y: 80, width: 870, height: 620, borderColor: gray, borderWidth: 1 });
  page.drawLine({ start: { x: 120, y: 390 }, end: { x: 820, y: 390 }, thickness: 1.2, color: gray });
  page.drawLine({ start: { x: 460, y: 80 }, end: { x: 460, y: 700 }, thickness: 1.2, color: gray });
  page.drawCircle({ x: 220, y: 520, size: 14, borderColor: blue, borderWidth: 1.4 });
  page.drawLine({ start: { x: 210, y: 510 }, end: { x: 230, y: 530 }, thickness: 1, color: blue });
  page.drawLine({ start: { x: 210, y: 530 }, end: { x: 230, y: 510 }, thickness: 1, color: blue });
  page.drawText("L1", { x: 238, y: 514, size: 10, font: normal, color: blue });
  page.drawCircle({ x: 620, y: 520, size: 14, borderColor: blue, borderWidth: 1.4 });
  page.drawLine({ start: { x: 610, y: 510 }, end: { x: 630, y: 530 }, thickness: 1, color: blue });
  page.drawLine({ start: { x: 610, y: 530 }, end: { x: 630, y: 510 }, thickness: 1, color: blue });
  page.drawText("L2", { x: 638, y: 514, size: 10, font: normal, color: blue });
  page.drawRectangle({ x: 945, y: 80, width: 200, height: 160, borderColor: gray, borderWidth: 1 });
  page.drawText("TITLE BLOCK", { x: 962, y: 215, size: 10, font: bold, color: navy });
  page.drawText("Drawing: E-101", { x: 962, y: 190, size: 9, font: normal, color: gray });
  page.drawText("Revision: P01", { x: 962, y: 172, size: 9, font: normal, color: gray });
  page.drawText("Scale: 1:100", { x: 962, y: 154, size: 9, font: normal, color: gray });
  page.drawText("Status: For review", { x: 962, y: 136, size: 9, font: normal, color: gray });
  return doc.save();
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
