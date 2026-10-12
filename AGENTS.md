<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## External APIs

Rules (apply to every API):
- Use ONLY the APIs listed here. Never invent endpoints, parameters or
  response fields. If a field is not in docs/apis/<name>.md, stop and ask.
- All calls are server-side, in src/lib/apis/<name>.ts. Never call from the
  browser. Secrets only in .env and listed in .env.example.
- Every client: timeout, retry limit, zod validation of input AND response,
  typed errors, and a Vitest test using a recorded fixture. No live calls in tests.
- Cache responses where terms allow it, and respect each API's rate limits.
- Before using an API in production, record its licence/terms status in
  docs/apis/<name>.md. Status "unverified" must show a visible warning in the UI.
- When you use an API, cite the docs/apis file you relied on.

| API | Purpose | Doc file | Status |
|---|---|---|---|
| PVGIS 5.3 | Solar production (already integrated) | docs/apis/pvgis.md | in use |
| Nominatim (OpenStreetMap) | Address geocoding | docs/apis/nominatim.md | planned |
| Open-Meteo | Weather / irradiance context | docs/apis/open-meteo.md | planned |
| Electricity tariffs | Tariff inputs for payback | docs/apis/tariffs.md | no API chosen |
