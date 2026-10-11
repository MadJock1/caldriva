import { z } from "zod";

export const REGISTRY_VERSION = "eu-electrical-2026-10-11.1";
export const PROJECT_CATEGORIES = ["residential", "apartment_building", "commercial", "industrial", "assembly", "machinery", "control_cabinet", "pv", "ev", "other"] as const;
export type ProjectCategory = typeof PROJECT_CATEGORIES[number];
export const categoryLabels: Record<ProjectCategory, string> = {
  residential: "Residential electrical installation", apartment_building: "Apartment building electrical distribution",
  commercial: "Commercial electrical installation", industrial: "Industrial building installation",
  assembly: "Low-voltage switchgear / distribution-board assembly", machinery: "Industrial machinery electrical equipment",
  control_cabinet: "Automation and control cabinet", pv: "Solar PV electrical integration", ev: "EV charging installation", other: "Other electrical project",
};
export const EARTHING_SYSTEMS = ["TT", "TN-S", "TN-C", "TN-C-S", "IT"] as const;
export const JURISDICTIONS = ["PT", "FR", "DE", "ES", "OTHER"] as const;
export type Jurisdiction = typeof JURISDICTIONS[number];

// These bounds are software input limits, not regulatory acceptance thresholds.
export const complianceContextSchema = z.object({
  version: z.literal(1).default(1),
  registryVersion: z.string().max(80).default(REGISTRY_VERSION),
  category: z.enum(PROJECT_CATEGORIES).nullable().default(null),
  jurisdiction: z.enum(JURISDICTIONS).nullable().default(null),
  assemblyType: z.enum(["power", "ordinary_persons", "other"]).nullable().default(null),
  assemblyRatedCurrentA: z.number().positive().max(100000).nullable().default(null),
  productOnMarket: z.enum(["yes", "no", "unknown"]).default("unknown"),
  machineIntegration: z.enum(["yes", "no", "unknown"]).default("unknown"),
  emcScope: z.enum(["apparatus", "fixed_installation", "unknown"]).default("unknown"),
  marketDate: z.iso.date().nullable().default(null),
  frequencyHz: z.number().positive().max(400).nullable().default(null),
  lineNeutralV: z.number().positive().max(1000).nullable().default(null),
  neutral: z.enum(["yes", "no", "unknown"]).default("unknown"),
  earthing: z.enum(EARTHING_SYSTEMS).nullable().default(null),
  earthingConfirmed: z.boolean().default(false),
  supplyConfirmed: z.boolean().default(false),
  supplyConfirmationKey: z.string().max(2000).nullable().default(null),
  supplySource: z.string().max(300).default(""),
  utility: z.string().max(300).default(""),
  faultCurrentKa: z.number().positive().max(1000).nullable().default(null),
  faultCurrentEvidence: z.string().max(1000).default(""),
  reviewNotes: z.string().max(3000).default(""),
});
export type ComplianceContext = z.infer<typeof complianceContextSchema>;
export const newComplianceContext = () => complianceContextSchema.parse({});

export function supplyContextKey(service: { voltageV: number; phases: number; supplyType: string }, context: ComplianceContext) {
  return JSON.stringify([service.voltageV, service.phases, service.supplyType, context.frequencyHz, context.neutral, service.phases === 1 ? service.voltageV : context.lineNeutralV, context.supplySource, context.utility]);
}

export const supplyPresets = {
  single: { voltageV: 230, phases: 1 as const, supplyType: "single" as const, lineNeutralV: 230, frequencyHz: 50, neutral: "yes" as const },
  three: { voltageV: 400, phases: 3 as const, supplyType: "three" as const, lineNeutralV: 230, frequencyHz: 50, neutral: "yes" as const },
};
