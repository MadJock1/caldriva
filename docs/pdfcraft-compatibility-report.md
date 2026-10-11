# PdfCraft Compatibility And Licensing Report

Reviewed repository: `https://github.com/storytold/pdfcraft`

Reviewed locally from a fresh checkout on 2026-10-11.

## Summary

PdfCraft is a Rust PDF application/workspace, not a CAD geometry engine. It should not replace Caldriva's CAD engine, model-space geometry, electrical symbol model, DXF export, or sheet generator.

The useful integration boundary is a PDF document service for generated or uploaded drawing packages: PDF inspection, raster previews, page organization, annotations/comments, splitting, extracting, combining, and review automation.

## Repository Shape

- Cargo workspace, Rust 2024, Rust >= 1.90.
- Workspace version observed: `0.6.0`.
- Main binaries:
  - `apps/pdfcraft`: native egui/eframe desktop application.
  - `apps/pdfcraft-web`: egui shell compiled to WebAssembly with `trunk`; not a React component.
  - `apps/pdfcraft-cli`: headless CLI exposing inspect, render, combine, extract, split, run, UI control, and opt-in MCP.
- Core reusable crates include `cos`, `model`, `render`, `annot`, `organize`, `engine`, and `automation`.

## Capability Assessment

| Area | Assessment | Caldriva Recommendation |
|---|---|---|
| PDF rendering | Mature design with CPU rendering via vendored hayro family, tiling, resource limits, page isolation, thumbnails. | Good future server-side preview candidate. Do not embed full egui renderer in React POC. |
| Page zoom/navigation | Implemented in PdfCraft UI; reusable behavior mainly through rendered page images and metadata. | Caldriva UI should implement its own React zoom/pan; PdfCraft can later supply page raster tiles. |
| Annotations | `pdfcraft-annot` supports comments, highlights, underline, strikeout, square, circle, line/arrow, ink, freetext, replies, review state. | Strong future fit for server-side reviewed-PDF output. POC stores Caldriva review comments and writes a review summary page with `pdf-lib`. |
| Merge/split/extract | CLI and automation support combine/extract/split while preserving content where possible. | Strong future fit for drawing package assembly service. |
| PDF editing | Broad surface exists, routed through engine and automation. | Use selectively only for PDF-level review/package workflows, not CAD edits. |
| Browser/WASM | `apps/pdfcraft-web` is egui/eframe WebAssembly. | Not suitable to import directly into Next.js/React. Isolated iframe/WASM app is possible later but heavier than needed. |
| Rust CLI/API | `pdfcraft-cli` and `pdfcraft-automation` provide the cleanest non-UI integration boundary. | Preferred future integration: server-side CLI/service behind authenticated Next.js routes/jobs. |
| Performance | Architecture includes tiling, render pool, watchdog/resource limits. | Suitable for future server-side preview generation with request limits. |
| Security | Workspace forbids unsafe code, documents bounded sizes/resources, root-confined automation paths, opt-in MCP. | Aligns with Caldriva needs; still run as isolated process/container with input size/time limits. |
| Maintenance maturity | Large workspace, architecture docs, CI gates, many tests, release docs. Some renderer/model replacement is still described as ongoing. | Stable enough for cautious CLI/service integration, not for copying internals into Caldriva. |

## Integration Architecture

Caldriva keeps three separate layers:

1. **CAD Engine**
   Editable geometry, symbols, layers, circuits, model space, and electrical intelligence remain TypeScript/Caldriva-owned.

2. **Sheet Generator**
   Caldriva generates sheets with exact drawing scales, paper sizes, title blocks, DXF, and vector PDFs. This layer preserves engineering scale and must not rasterize CAD geometry unnecessarily.

3. **PdfCraft Document Service**
   Future Rust service/CLI for PDF inspection, rendering previews, thumbnails, page management, annotations, review state, and package operations.

## Approach Decision

Evaluated approaches:

- **A. Isolated browser WebAssembly module**
  - Possible through `apps/pdfcraft-web`, but it is an egui application shell, not reusable React UI.
  - Would duplicate Caldriva's document UI and complicate auth/storage integration.
  - Not selected for the first integration.

- **B. Server-side Rust CLI or service**
  - Supported by `pdfcraft-cli` and `pdfcraft-automation`.
  - Gives clear process isolation, root-confined paths, and simple job boundaries.
  - Best future path for secure rendering, inspection, annotations, merging, splitting, and package automation.

Chosen integration path: **server-side PdfCraft CLI/service later; Caldriva React PDF review POC now.**

The proof of concept intentionally does not vendor PdfCraft code yet. It establishes the Caldriva review UI, upload constraints, review metadata, and vector-preserving reviewed PDF output. PdfCraft can be introduced behind this boundary when the CLI binary/service is available in deployment.

## Licensing

- Source license: `MIT OR Apache-2.0`.
- Preserve `LICENSE-MIT`, `LICENSE-APACHE`, `NOTICE`, and relevant third-party attribution if PdfCraft code/binaries/assets are distributed with Caldriva.
- `NOTICE` identifies required third-party notices for Lucide, fonts, hayro/Foxit fonts, Adobe CMap resources, lopdf, egui fonts, and vendored crates.
- ArtCraft name, wordmark, and logos under `docs/brand/` are excluded from the open-source license and must not be copied into Caldriva.
- Caldriva must not use ArtCraft branding or imply endorsement.

## Security Requirements For Future PdfCraft Service

- Authenticate every PDF operation through Caldriva user/session ownership.
- Enforce existing PDF size limits or stricter service limits.
- Store files under owned Supabase paths or root-confined temp job directories.
- Run PdfCraft CLI/service with CPU, memory, wall-clock, and output-size limits.
- Reject non-PDF MIME types and validate PDF headers before processing.
- Avoid automatic network/MCP exposure. MCP must remain off unless explicitly configured for internal operations.
- Preserve originals; write reviewed/merged outputs as separate revisions.

## Current POC Scope

Implemented in Caldriva without importing PdfCraft UI:

- Browser upload/open for PDF drawings.
- Page inspection with paper dimensions.
- Native PDF display with zoom controls and pan/scroll area.
- Page thumbnails/list from inspected pages.
- Engineering comments and markup metadata.
- Revision and drawing status fields.
- Download of reviewed PDF with original pages copied vector-preserving and a Caldriva review summary page appended.

Not claimed in the POC:

- PdfCraft Rust rendering inside Caldriva.
- Embedded PDF annotations inside original pages.
- Server-side PdfCraft CLI execution.
- Supabase drawing package persistence.
