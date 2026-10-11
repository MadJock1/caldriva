import { z } from "zod";
import { electricalBuildingSchema } from "./model";

export const electricalIdentitySchema = z.object({ id: z.uuid(), version: z.number().int().positive() });
export type ElectricalIdentity = z.infer<typeof electricalIdentitySchema>;

export const electricalSaveSchema = z.object({
  identity: electricalIdentitySchema.nullable(),
  draft: electricalBuildingSchema,
});

export const electricalSummarySchema = electricalIdentitySchema.extend({
  name: z.string(),
  updated_at: z.string(),
});
export type ElectricalSummary = z.infer<typeof electricalSummarySchema>;
