import { z } from "zod";
import { buildingSchema } from "./building";
export const cloudIdentitySchema = z.object({ id: z.uuid(), version: z.number().int().positive() });
export type CloudIdentity = z.infer<typeof cloudIdentitySchema>;
export const cloudSaveSchema = z.object({ identity: cloudIdentitySchema.nullable(), draft: buildingSchema });
export const cloudSummarySchema = cloudIdentitySchema.extend({ name: z.string(), updated_at: z.string() });
export type CloudSummary = z.infer<typeof cloudSummarySchema>;
