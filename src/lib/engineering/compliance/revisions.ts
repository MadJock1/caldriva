import { z } from "zod";
import { ENGINE_VERSION, type ElectricalBuilding, type LoadItem } from "../../electrical/model";
import { evaluateCompliance } from "./evaluate";
import { JURISDICTIONS, PROJECT_CATEGORIES, REGISTRY_VERSION, newComplianceContext } from "./context";

// Phase 6: immutable compliance revisions and stale-report detection.
//
// A revision freezes the software evaluation at a point in time together with a
// content fingerprint of the project inputs that produced it. Revisions are
// append-only: once created they are frozen and never edited. A later project edit
// is detected by comparing fingerprints (staleness), not by mutating the revision.

export const COMPLIANCE_REVISION_DISCLAIMER =
  "Automated screening record. This document does not constitute certification, a CE declaration of conformity, an installation inspection certificate, or approval for construction. It records the software evaluation and registry baseline at the stated revision; professional approval remains NOT ASSESSED and must be performed by a qualified engineer.";

export const complianceRevisionSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1).max(80),
  revisionNumber: z.number().int().positive().max(100000),
  createdAt: z.string().datetime(),
  createdBy: z.string().max(120),
  fingerprint: z.string().min(8).max(64),
  registryVersion: z.string().max(80),
  engineVersion: z.string().max(40),
  category: z.enum(PROJECT_CATEGORIES).nullable(),
  jurisdiction: z.enum(JURISDICTIONS).nullable(),
  counts: z.object({
    pass: z.number().int().nonnegative(),
    fail: z.number().int().nonnegative(),
    warning: z.number().int().nonnegative(),
    missingData: z.number().int().nonnegative(),
    notApplicable: z.number().int().nonnegative(),
    notEvaluated: z.number().int().nonnegative(),
    requiresProfessionalReview: z.number().int().nonnegative(),
  }),
  checks: z.array(z.object({
    id: z.string().max(80),
    title: z.string().max(200),
    status: z.string().max(60),
    reference: z.string().max(200),
    edition: z.string().max(80).nullable(),
  })).max(200),
  matrix: z.array(z.object({
    id: z.string().max(80),
    identifier: z.string().max(200),
    status: z.string().max(60),
  })).max(200),
  calculations: z.object({
    demandVA: z.number().finite().nonnegative(),
    currentA: z.number().finite().nonnegative(),
    engineVersion: z.string().max(40),
  }),
  disclaimer: z.string().max(1000),
});
export type ComplianceRevision = z.infer<typeof complianceRevisionSchema>;

export const complianceRevisionListSchema = z.array(complianceRevisionSchema).max(200);

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(",")}}`;
}

// Non-cryptographic content fingerprint (FNV-1a 64-bit). Used to detect whether the
// inputs behind a revision changed; it is not a digital signature or authentication.
export function fingerprintOf(value: unknown): string {
  const text = stableStringify(value);
  let hash = BigInt("0xcbf29ce484222325");
  const prime = BigInt("0x100000001b3");
  const mask = BigInt("0xffffffffffffffff");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= BigInt(text.charCodeAt(i));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}

function loadSignature(load: LoadItem) {
  return [load.kind, load.ratedWatts, load.powerFactor, load.phases, load.quantity, load.utilisationFactor, load.demandFactor];
}

/** Only the inputs that affect the compliance evaluation, in a canonical form. */
export function complianceInputSignature(building: ElectricalBuilding) {
  const c = building.compliance ?? newComplianceContext();
  return {
    registryVersion: c.registryVersion ?? REGISTRY_VERSION,
    engineVersion: ENGINE_VERSION,
    service: building.service,
    cableAssumptions: building.cableAssumptions,
    compliance: c,
    commonLoads: building.commonLoads.map(loadSignature),
    floors: building.floors.map(floor => ({
      code: floor.code,
      sharedLoads: floor.sharedLoads.map(loadSignature),
      apartments: floor.apartments.map(apartment => ({
        code: apartment.code,
        rooms: apartment.rooms.map(room => ({ type: room.type, area: room.area, loads: room.loads.map(loadSignature) })),
      })),
    })),
  };
}

export function complianceFingerprint(building: ElectricalBuilding): string {
  return fingerprintOf(complianceInputSignature(building));
}

export function nextRevisionNumber(revisions: ComplianceRevision[]): number {
  return revisions.reduce((max, revision) => Math.max(max, revision.revisionNumber), 0) + 1;
}

export type CreateRevisionOptions = { createdBy?: string; revisionNumber: number; now?: string };

export function createComplianceRevision(building: ElectricalBuilding, options: CreateRevisionOptions): ComplianceRevision {
  const report = evaluateCompliance(building);
  const c = building.compliance ?? newComplianceContext();
  const fingerprint = complianceFingerprint(building);
  const count = (status: string) => report.checks.filter(check => check.status === status).length;
  const revision: ComplianceRevision = {
    schemaVersion: 1,
    id: `CR-${options.revisionNumber}-${fingerprint.slice(0, 8).toUpperCase()}`,
    revisionNumber: options.revisionNumber,
    createdAt: options.now ?? new Date().toISOString(),
    createdBy: (options.createdBy ?? "").trim().slice(0, 120),
    fingerprint,
    registryVersion: report.registryVersion,
    engineVersion: report.calculations.engineVersion,
    category: c.category,
    jurisdiction: c.jurisdiction,
    counts: {
      pass: count("PASS"),
      fail: count("FAIL"),
      warning: count("WARNING"),
      missingData: count("MISSING DATA"),
      notApplicable: count("NOT APPLICABLE"),
      notEvaluated: count("NOT EVALUATED"),
      requiresProfessionalReview: count("REQUIRES PROFESSIONAL REVIEW"),
    },
    checks: report.checks.map(check => ({ id: check.id, title: check.title, status: check.status, reference: check.reference, edition: check.edition })),
    matrix: report.matrix.map(row => ({ id: row.reference.id, identifier: row.reference.identifier, status: row.status })),
    calculations: { demandVA: report.calculations.demandVA, currentA: report.calculations.current.result, engineVersion: report.calculations.engineVersion },
    disclaimer: COMPLIANCE_REVISION_DISCLAIMER,
  };
  Object.freeze(revision);
  Object.freeze(revision.counts);
  Object.freeze(revision.checks);
  Object.freeze(revision.matrix);
  return revision;
}

export function isRevisionStale(revision: ComplianceRevision, building: ElectricalBuilding): boolean {
  return complianceFingerprint(building) !== revision.fingerprint;
}

export function appendRevision(revisions: ComplianceRevision[], revision: ComplianceRevision): ComplianceRevision[] {
  return [...revisions, revision];
}

export function parseRevisions(raw: unknown): ComplianceRevision[] {
  const parsed = complianceRevisionListSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}
