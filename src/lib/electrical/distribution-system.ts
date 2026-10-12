import { z } from "zod";

export const DISTRIBUTION_NODE_TYPES = ["UTILITY_BOUNDARY", "QUADRO_COLUNAS", "METER", "APARTMENT_BOARD", "COMMON_SERVICES_BOARD"] as const;
export const distributionNodeSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.enum(DISTRIBUTION_NODE_TYPES),
  label: z.string().min(1).max(160),
  parentId: z.string().max(80).nullable().default(null),
  apartmentId: z.string().max(64).nullable().default(null),
  floorId: z.string().max(64).nullable().default(null),
  phases: z.union([z.literal(1), z.literal(3)]),
  voltageV: z.number().positive(),
  status: z.enum(["PRELIMINARY", "REQUIRES_REVIEW", "REVIEWED"]).default("PRELIMINARY"),
});
export const distributionFeederSchema = z.object({
  id: z.string().min(1).max(80),
  fromNodeId: z.string().min(1).max(80),
  toNodeId: z.string().min(1).max(80),
  purpose: z.enum(["MAIN", "APARTMENT", "COMMON_SERVICES"]),
  status: z.enum(["PRELIMINARY", "REQUIRES_REVIEW", "REVIEWED"]).default("PRELIMINARY"),
});
export const distributionSystemSchema = z.object({
  schemaVersion: z.literal(1),
  nodes: z.array(distributionNodeSchema).max(2000),
  feeders: z.array(distributionFeederSchema).max(4000),
  warnings: z.array(z.string().max(400)).max(100),
});
export type DistributionSystem = z.infer<typeof distributionSystemSchema>;
