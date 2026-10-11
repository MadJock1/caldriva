# Electrical standards integration — Phases 1–2

## Integration plan and implemented boundary

1. Extend canonical `ElectricalBuilding` with optional, versioned `compliance` context. Older drafts remain valid. Keep service voltage/phases in the existing service model.
2. Add a code-reviewed, versioned metadata registry and deterministic category/jurisdiction screening. Keep technical-rule verification separate from metadata verification.
3. Derive applicability, input checks and calculation evidence from the live building. Persist context through existing local/cloud drafts without a second project state.
4. Add the Standards & Compliance tab, tests and source documentation. Later milestones add verified technical rules, reports, professional review and product documentation.

Implemented: ten project categories; jurisdiction confirmation; Portugal-first national review scaffold; future France/Germany/Spain packs; unsupported-scope handling; assembly-part screening; cabinet/machinery questions; machinery transition screening; EMC apparatus/fixed-installation distinction; product-specific LVD/Ecodesign screening; 230 V single-phase and 400/230 V three-phase 50 Hz presets; editable supply, neutral and TT/TN-S/TN-C/TN-C-S/IT context; fault-current source capture; individual check evidence and author notes.

Existing building `category` describes the generator. `compliance.category` describes the installation/product being assessed. Selecting jurisdiction updates existing country/jurisdiction labels. Generation retains context but clears supply confirmation. Supply confirmation is bound to the input values and becomes invalid if another tab changes them. Earthing is never inferred from country: no authoritative review established a suitable Portugal default for all supported installation scopes.

## Source verification register

Registry: `eu-electrical-2026-10-11.1`. Consultation date: **2026-10-11**. Verification dates are fixed provenance, not browser-clock values. A different saved revision raises a warning; adopting a new baseline requires an explicit action. Historical compiled registries and signed evaluation snapshots are future work.

| Reference | Verified metadata | Further review |
| --- | --- | --- |
| [2014/35/EU](https://eur-lex.europa.eu/eli/dir/2014/35/oj/eng) | Original act identity, general scope, application from 2016-04-20 | Consolidated amendments, exclusions, transposition, project applicability |
| [2014/30/EU](https://eur-lex.europa.eu/eli/dir/2014/30/oj/eng) | Original identity, application date, apparatus/fixed-installation distinction | Consolidated amendments, exclusions, technical EMC assessment |
| [Commission machinery guidance](https://single-market-economy.ec.europa.eu/sectors/mechanical-engineering/machinery_en) | Directive 2006/42/EC framework and corrected general mandatory application of Regulation 2023/1230 from **2027-01-20** | Exceptions, transitional/early-applying provisions, full amended texts |
| [Decision 2023/2723, consolidated 2026-04-30](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02023D2723-20260430) | Listed identifiers/titles: **EN 61439-1:2011**, **EN 61439-2:2011**, **EN 61439-3:2012**, Part 3 AC:2019-04, **EN 60204-1:2018** | Latest technical editions, complete amendments, national adoptions, project scope and machinery-specific harmonisation |
| [RTIEBT official ELI destination](https://data.dre.pt/eli/port/949-a/2006/09/11/p/dre/pt/html) | Destination identified; retrieval required JavaScript and yielded no inspectable consolidated text | **Source review required** for dates, amendments, scope and technical rules |
| HD 60364, IEC 60909, EN ISO 13849 / EN IEC 62061, equipment/cable standards | Candidate families only | Relevant parts, EN versus IEC adoption, licensed texts, technical rules |
| NF C 15-100, DIN VDE 0100, REBT | Future national-pack candidates only | Current national texts, editions and implementation |
| Ecodesign | Product-specific screening placeholder | Product group and applicable instruments/measures |

The original OJ Machinery Regulation contains a January 14 date error; Commission guidance confirms the corrigendum and January 20. Only the general transition is screened.

The Commission [LVD standards page](https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/low-voltage-lvd_en) states that its summary lists have not been updated since April 2025. The registry instead records the consulted EUR-Lex consolidated decision. An OJ-listed EN edition is not a claim that the latest IEC/EN IEC edition is identical, applicable, or harmonised under another instrument.

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

## Remaining milestones

Verification completed for this slice: ESLint and TypeScript passed; **142 unit/PostgreSQL integration tests** passed across 19 files; the production build generated **42 routes**; **58 desktop/mobile browser tests** passed. These results verify software behaviour, not installation conformity.

- Phases 3–4: deeper calculation evidence, licensed source verification, validated technical rules, independently reviewed engineering reference cases.
- Phases 5–6: diagram-linked issues, immutable revisions, stale-report detection and white print-friendly PDF compliance reports with the required disclaimer.
- Phase 7: full assembly design/routine-verification evidence and machinery technical checklists/functional safety.
- Phase 8: qualified reviewer assignment, qualifications, evidence uploads, authorized decisions and immutable audit trail. Author notes are not this workflow.
- Phase 9: product-specific CE documentation assistance and manufacturer evidence, with individual legislative applicability. Never an automatic CE award.

DWG/DXF **import** remains unimplemented. Existing manual CAD geometry and DXF export remain available; this integration does not imply an import pipeline.
