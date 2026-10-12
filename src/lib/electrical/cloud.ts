import { z } from "zod";
import { electricalBuildingSchema, migrateElectricalBuildingDraft } from "./model";

export const electricalIdentitySchema = z.object({ id: z.uuid(), version: z.number().int().positive() });
export type ElectricalIdentity = z.infer<typeof electricalIdentitySchema>;

export const electricalDraftSchema = z.preprocess(migrateElectricalBuildingDraft, electricalBuildingSchema);

export const electricalSaveSchema = z.object({
  identity: electricalIdentitySchema.nullable(),
  draft: electricalDraftSchema,
});

export const electricalSummarySchema = electricalIdentitySchema.extend({
  name: z.string(),
  updated_at: z.string(),
});
export type ElectricalSummary = z.infer<typeof electricalSummarySchema>;
