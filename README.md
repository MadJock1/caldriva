# Caldriva Engineering & Technology

Early working foundation: public website, local Building Studio and a minimum functional PVGIS solar workflow. This is **not the completed production platform** described in the master specification.

## Run locally

Requirements: Node.js 24+ and npm. From the `caldriva` directory:

```sh
npm install
npm run dev
```

Open http://localhost:3000 or http://localhost:3000/tools/solar. No API keys are required for this local milestone. The map and solar estimate require internet access.

## Implemented

- Configurable branding in `src/lib/brand.ts`, responsive navigation, homepage, services and tools directories, discipline scopes and informational pages.
- Contact and legal placeholders clearly identified; downloadable draft project brief (not submitted).
- Leaflet/OpenStreetMap location selection, roof drawing, vertex edits and approximate horizontal area with crossed-edge validation.
- Versioned, validated building draft saved/reopened/deleted in browser localStorage.
- Supabase email/password account forms, PKCE confirmation callback, session refresh proxy and protected customer building dashboard (requires configuration).
- Cloud draft save/reopen/delete with an owner-only RLS migration and optimistic save-version checks. Setup: `docs/SUPABASE_SETUP.md`.
- Server-side PVGIS 5.3 integration with input/response validation, timeout, upstream error handling and instance-wide request guard.
- Manual panel count, Wp→kWp calculation, compass→PVGIS azimuth conversion, monthly/annual production and specific yield.
- Simplified annual self-consumption/export balance, net savings and simple payback; clear calculation inputs, sources, version and review status.
- Named scenario snapshots saved in the browser (20 max) or to cloud (`simulations`/`simulation_inputs`/`simulation_results` with immutable results), reopen and side-by-side comparison; cloud saves re-verify production server-side via PVGIS.
- Preliminary PDF report (`/api/reports/solar`, `pdf-lib`) with horizontal roof-grid layout, monthly chart, assumptions and explicit "not engineer-reviewed, certified or approved" labelling; request body cap and per-instance rate guard.
- Dark midnight-navy theme across public pages, dashboards and the studio.
- Private building file storage: owner-scoped uploads (PDF, image, CAD, CSV, Excel ≤10 MB) with SHA-256 checksum, metadata in `building_files` and bytes in the private `building-files` Storage bucket; signed download URLs (5 min) and deletion via server actions; Storage bucket and object policies applied separately (`supabase/storage/building_files.sql`). `/dashboard/buildings/[id]/files` lists, uploads, downloads and removes files; linked from each cloud building card.
- Auto Electrical Design Studio at `/tools/electrical`: a deterministic multistorey-building electrical module (`src/lib/electrical/`). A structured brief generates an editable hierarchy (floors → apartments → rooms → loads) from T0–T5/CUSTOM templates; loads aggregate to connected/demand/energy with editable diversity and design margin and per-phase balance; circuits group into MDB→floor→apartment boards plus a common services board with generated single-line and riser diagrams; a review engine reports pass/check/blocked/manual findings and never auto-approves. A floor-plan editor lays rooms out in metres per floor, links them to the hierarchy, proposes lighting/socket/switch/dedicated points deterministically from room type and area, and can sync point counts back into the load model; a point→circuit scheduling engine traces each point to the matching apartment circuit, writes circuit ids back onto loads, and produces a Point schedule with coverage warnings. A cable-route sketch (L-shaped Manhattan paths) yields route lengths that feed a preliminary voltage-drop estimate from editable cable assumptions, feeding the review engine. Browser-local drafts plus owner-only cloud persistence (`electrical_designs`/`electrical_drafts`, migration `202610100005`) at `/dashboard/electrical`.
- Floor-plan CAD controls: Shift-click/marquee room selection, grouped movement, 50-entry session undo/redo, 10 cm grid/object snapping, alignment guides, editable dimensions and dimension locks, one-shot alignment/equal-size commands, room copy/paste/duplicate, pan/zoom, wall-thickness and door/window annotations, and point/route visibility. SVG/PNG export captures the full plan; DXF geometry export contains room outlines, electrical points and route segments in metres. Room geometry changes carry attached points and invalidate stale route calculations.
- Tests for calculation units, energy conservation, geometry, panel layout, snapshot/report validation, quotation transitions and totals, RLS ownership/immutability and the quotation role/transition guards, local drafts, responsive layout and result invalidation.

## Verification

Electrical Studio includes **8. Standards & Compliance**: project classification, jurisdiction and supply context, a versioned source registry, applicability screening and traceable input checks. See [source verification, licensing and scope](docs/ELECTRICAL_STANDARDS.md). Technical standards checks and professional approval remain unevaluated.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright starts the production build on port 3100. Browser solar tests intercept PVGIS with a labelled deterministic fixture; production has no fake-result fallback. A separate live PVGIS request was verified during development. Live Supabase verification is explicit and currently blocked; see `docs/LIVE_VERIFICATION.md`.

## Scope limitations / next phase

- One local building/roof draft; multiple private cloud building drafts when Supabase is configured. Shared projects are not implemented. Provenance currently identifies user-supplied inputs and estimated polygon area as categories, not full per-field audit records.
- Address is a reference field, not geocoding. Coordinate entry and map selection work. A licensed geocoder adapter remains to be added.
- Roof polygon and PV panel count remain independent. The preliminary layout is a horizontal grid fit for communication only: no setbacks beyond the chosen margin, obstacle exclusions, multiple planes, pitch inference, structural checks, detailed shading or sloped-plane fit.
- Scenario comparison covers production and the simplified annual finance only. No battery dispatch, hourly load matching, long-term degradation/tariff model or shared comparison workspace.
- The PDF report is preliminary and generated from the stored snapshot; it is not a certified or stamped design.
- Quotations are engineering estimates for discussion, not contractual offers. There is no payment, invoicing, messaging thread, file upload/drawing exchange or email notification yet; the engineer must share external drawings out of band. Staff roles must be assigned by an administrator (bootstrap documented in `docs/SUPABASE_SETUP.md`); there is no self-service engineer sign-up. Tenant/organization membership, admin-audit trails and SLA timers are not implemented.
- The building-draft, solar-simulation, quotation-workflow, private file storage and electrical-design Supabase migrations and owner/staff RLS are implemented and tested in PGlite. Hosted authentication/SMTP/PostgREST integration still requires configuration and live verification (see `docs/LIVE_VERIFICATION.md`). Organisation membership and admin tooling remain unimplemented. The database design and roadmap are in `docs/IMPLEMENTATION.md`.
- The Auto Electrical Design Studio is a preliminary automated tool. It does not import DWG/IFC/vector-PDF drawings, trace real cable routes, select verified cables or protective devices, or certify compliance with any wiring regulation. Floor-plan point placement is a deterministic proposal from room type and area; cable routes are simplified L-shaped sketches and the voltage-drop figure is a preliminary estimate from editable, unverified cable assumptions. Geometry is not georeferenced. Outputs must be completed and signed off by a qualified engineer before construction.
- Company contact/legal information must be supplied. No professional credentials or approval status are asserted.
- Production needs shared edge rate limiting, provider/imagery license review and deployment monitoring. Current request guard is per server instance, not per user.
- npm audit currently reports five high-severity findings in the development-only ESLint → fast-glob → micromatch → braces chain. npm's proposed forced remediation downgrades Next ESLint configuration incompatibly; it was not applied. Resolve the upstream lint-tool advisory before release.

## Engineering methodology

PVGIS estimates crystalline-silicon production with the selected mounting, user-confirmed tilt and compass azimuth, declared system losses and terrain horizon. Nearby obstacles are not modelled. Annual finance is `selfUsed = min(production × assumed self-use share, annual demand)`; exports are the remaining production. Net savings subtract annual maintenance from avoided imports plus export income. Simple payback is installed cost divided by positive net savings, otherwise unavailable. This annual balance cannot establish hourly self-consumption or battery performance.

Roof area is Turf spherical GeoJSON area; Leaflet latitude/longitude is explicitly converted to GeoJSON longitude/latitude. This is a horizontal estimate, not usable panel area or measured sloping roof area.
