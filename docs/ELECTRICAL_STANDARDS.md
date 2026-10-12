# Electrical standards integration — Phases 1–2

## Integration plan and implemented boundary

1. Extend canonical `ElectricalBuilding` with optional, versioned `compliance` context. Older drafts remain valid. Keep service voltage/phases in the existing service model.
2. Add a code-reviewed, versioned metadata registry and deterministic category/jurisdiction screening. Keep technical-rule verification separate from metadata verification.
3. Derive applicability, input checks and calculation evidence from the live building. Persist context through existing local/cloud drafts without a second project state.
4. Add the Standards & Compliance tab, tests and source documentation. Later milestones add verified technical rules, reports, professional review and product documentation.

Implemented: ten project categories; jurisdiction confirmation; Portugal-first national review scaffold; future France/Germany/Spain packs; unsupported-scope handling; assembly-part screening; cabinet/machinery questions; machinery transition screening; EMC apparatus/fixed-installation distinction; product-specific LVD/Ecodesign screening; 230 V single-phase and 400/230 V three-phase 50 Hz presets; editable supply, neutral and TT/TN-S/TN-C/TN-C-S/IT context; fault-current source capture; individual check evidence and author notes.

Existing building `category` describes the generator. `compliance.category` describes the installation/product being assessed. Selecting jurisdiction updates existing country/jurisdiction labels. Generation retains context but clears supply confirmation. Supply confirmation is bound to the input values and becomes invalid if another tab changes them. Earthing is never inferred from country: no authoritative review established a suitable Portugal default for all supported installation scopes.

## Source verification register (update for licensed-source guardrails)

**Important (Phases 3–4 groundwork):** No executable technical rules derived from HD 60364, IEC 60909, EN 61439 series amendments, or national texts were added. Only **metadata and guardrails** were recorded. Before embedding any numerical limits or pass/fail thresholds from paid standards:
- Record a **publisher licence status** (per edition) in `docs/apis/standards-licensing.md` (or per reference), with reviewer and date.
- Verify the **exact edition, corrigendum and national adoption** for the jurisdiction.
- Do not redistribute clauses/tables. Store only citations, identifiers and provenance.
- Any rule that would return PASS/FAIL based on normative thresholds must carry `status: "unverified"` until a qualified reviewer confirms applicability and a licence exists.

The registry remains `eu-electrical-2026-10-11.1`. Retrieval notes for RTIEBT and other national texts remain outstanding. A `technicalRulesVersion` placeholder exists in evaluation provenance to prevent silent activation of unlicensed rules.

## Checks and calculation integration

PASS/FAIL checks are **Caldriva completeness/consistency policies**, not normative electrical compliance tests: classification present, registry revision matching, confirmed supply context, and service phase/type agreement. Other statuses identify missing load evidence, system-specific earthing review, fault-current evidence and unimplemented technical verification. Reviewer status is always `UNREVIEWED`; professional approval is `NOT ASSESSED`. Existing building workflow labels, including `APPROVED`, are not accepted as authenticated engineer approval.

Calculation evidence reuses `buildingSummary` and `lineCurrentA`, with inputs, units, method, assumptions, engine version and warnings. Current is `S/U` for single phase and `S/(sqrt(3) U_LL)` for balanced three phase. It does not verify cables, protective devices or fault protection. Load voltage/PF data remains explicit and needs review after supply changes. No regulatory numerical thresholds are embedded.

Integration uncovered an existing defect: the design margin passed through a diversity helper that clamped its multiplier to 1. Demand W/VA now multiply by `1 + designMargin`, preserving connected totals. Regression coverage checks the 10% margin and dependent current recalculation.

## Storage, configuration and licensing

- No new API keys or dependencies. The registry is bundled TypeScript; no arbitrary executable or remotely supplied rules.
- Context/author notes use existing `electrical_drafts.draft` JSONB, schema-validated Server Actions, owner-only RLS and optimistic-version RPC. **No SQL migration is needed for this optional JSON field.** PostgreSQL tests include private compliance notes in cross-user isolation checks.
- Registry metadata is code-versioned. Durable executions, report/calculation snapshots, uploads, revisions and approvals need future tables, migrations, authorization and audit controls.
- Hosted Supabase still needs environment configuration, deployed existing migrations and live test accounts. PGlite checks local SQL policies only.
- Only identifiers, short titles and original summaries are included. No paid standard clauses/tables are copied. Obtain suitable publisher licences and qualified source review before implementing rules; permission to read does not necessarily permit software redistribution.
- Recheck authoritative publishers, legislation and OJ citations before professional reliance. Metadata updates need a new registry version, documented review and regression tests. No automatic live standards updating is claimed.

## Test projects and limitations

`src/lib/engineering/verification/examples.ts` supplies A: Portuguese house, B: five-floor apartments, C: declared 630 A industrial assembly, D: packaging machine. These are classification fixtures, **not independently signed-off engineered designs**.

Independent analytical expectations: 2300 VA / 230 V = 10 A; 6928.203230275509 VA / (sqrt(3) × 400 V) = 10 A. Tests cover invalid PF/voltage/frequency/date inputs, all earthing selections, transition boundaries, assembly selection, unsupported/unverified references, registry revisions, recalculation, draft persistence and owner isolation. Browser coverage exercises the tab on desktop/mobile.

## Diagram-linked issues, revisions and reports (Phases 5–6)

`src/lib/electrical/design-issues.ts` merges the electrical `designReview` and the standards `evaluateCompliance` findings into `LinkedIssue`, each carrying `DiagramTarget` references (`board` / `circuit` / `floor`). Only defensible mappings link an issue to a diagram element: phase balance and demand basis map to the main board, over-limit voltage-drop rows map to their own circuits, and uncovered floor-plan points map to their floor. Findings with no single element (protection, earthing, safety zones, most regulatory and product checks) are reported as **project scope** rather than guessed onto a board. Issues are sorted most-severe first. The Distribution view renders an "Issues linked to the distribution" section whose target chips are anchors to the single-line board boxes, riser floors and board-schedule rows (`#board-<id>`, `#circuit-<id>`, `#floor-<id>`). A link identifies where an issue sits; it is not an automatic fix.

`src/lib/engineering/compliance/revisions.ts` adds immutable revisions and stale-report detection. `complianceFingerprint` hashes the evaluation-relevant project inputs (service, cable assumptions, compliance context, load schedule, registry/engine versions) with a non-cryptographic FNV-1a 64-bit content fingerprint. `createComplianceRevision` freezes an append-only `ComplianceRevision` snapshot (revision number, author, ISO timestamp, fingerprint, registry/engine versions, status counts, checks, applicability matrix, calculation evidence and the disclaimer); `isRevisionStale` compares the current project fingerprint against the frozen one. Revisions cannot be edited — a later edit marks the revision stale instead. `compliance-report.ts` renders a **white, print-friendly** A4 PDF (dark text, thin rules) reproducing the frozen revision with a prominent disclaimer and a `CURRENT` / `STALE` / `NOT CHECKED` staleness line, served by `POST /api/reports/compliance` (per-instance rate guard of 30/min, 200 KB body cap, JSON only, schema-validated). The Standards & Compliance tab adds a "Compliance revisions & reports" panel to create, list, and download revisions. Revisions persist to browser localStorage only; the fingerprint is a software integrity check, not a digital signature, and the report is not a certificate.

## Remaining milestones

Verification completed for this slice: ESLint and TypeScript passed; **142 unit/PostgreSQL integration tests** passed across 19 files; the production build generated **42 routes**; **58 desktop/mobile browser tests** passed. These results verify software behaviour, not installation conformity.

Verification for Phases 5–6: ESLint (0 errors) and TypeScript passed; **213 unit tests** across 31 files passed (adding diagram-link, revision, fingerprint/staleness and PDF-rendering coverage); the production build generated **46 routes**; **76 desktop/mobile browser tests** passed, including a new end-to-end check that records a revision, detects staleness after a project edit, and downloads the print-friendly PDF.

- Phases 3–4: deeper calculation evidence, licensed source verification, validated technical rules, independently reviewed engineering reference cases. **Work underway (guardrails only):** no executable thresholds derived from paid technical standards have been implemented; a `technicalRulesVersion` provenance field and a licensing checklist are tracked before any PASS/FAIL technical rule goes live.
- ~~Phases 5–6~~ **Implemented**: diagram-linked issues, immutable revisions, stale-report detection and white print-friendly PDF compliance reports with the required disclaimer (see above). Cloud-hosted revision storage, signed reviewer decisions and edit/delete auditing remain for Phase 8.
- ~~Phase 8~~ **Implemented**: qualified reviewer assignment, qualifications, evidence uploads not included, authorized decisions and immutable audit trail (see above). Reviewer qualification is an administrator-attested in-system record (not independently verified credentials); decisions are not certification, a CE declaration, an inspection certificate or approval for construction.
- Phase 7: full assembly design/routine-verification evidence and machinery technical checklists/functional safety. Added **scaffolding only** (category flags, assembly screening, machinery transition questions) with explicit “not evaluated” and “unverified” statuses; no licensed technical clauses implemented.
- Phase 9: product-specific CE documentation assistance and manufacturer evidence, with individual legislative applicability. Never an automatic CE award. **Scaffolding only**: product-on-market/machinery/EMC fields and LVD/Ecodesign screening placeholders; no manufacturer data collection pipeline or template generation.

DWG/DXF **import** remains unimplemented. Existing manual CAD geometry and DXF export remain available; this integration does not imply an import pipeline.
