import { z } from "zod";
import { area, polygon, kinks } from "@turf/turf";
import { solarInputSchema, financeSchema } from "./solar";
import { geocodedAddressSchema } from "./geocoding";

export const pointSchema = z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]);
export type MapPoint = z.infer<typeof pointSchema>;
export const buildingSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(150),
  address: z.string().max(500),
  geocodedAddress: geocodedAddressSchema.nullable().optional(),
  locationConfirmed: z.boolean().default(false),
  locationSource: z.enum(["address", "manual"]).optional(),
  roof: z.array(pointSchema).max(100),
  roofObstacles: z.array(z.array(pointSchema).min(3).max(100)).max(50).default([]),
  solar: solarInputSchema,
  finance: financeSchema,
  provenance: z.literal("user-supplied; polygon-area algorithmically-estimated"),
});
export type Building = z.infer<typeof buildingSchema>;
export const initialBuilding: Building = {
  version: 1, name: "Untitled building", address: "", geocodedAddress: null, locationConfirmed: false, roof: [], roofObstacles: [],
  solar: { latitude: 38.7223, longitude: -9.1393, tilt: 30, azimuth: 180, panels: 10, panelWatts: 430, losses: 14, mounting: "free" },
  finance: { consumption: 4000, selfConsumption: 40, importTariff: 0.25, exportTariff: 0.06, capex: 6500, annualOpex: 100 },
  provenance: "user-supplied; polygon-area algorithmically-estimated",
};
/** Input order is Leaflet [latitude,longitude]; GeoJSON requires [longitude,latitude]. */
export function horizontalRoofArea(points: MapPoint[]) {
  if (points.length < 3) return 0;
  z.array(pointSchema).max(100).parse(points);
  const ring = points.map(([lat, lon]) => [lon, lat]);
  const shape = polygon([[...ring, ring[0]]]);
  if (kinks(shape).features.length) throw new Error("Roof edges cross. Edit the vertices to form a simple polygon.");
  const result = area(shape);
  if (result < 0.1 || result > 100000) throw new Error("Draw a roof between 0.1 and 100,000 m².");
  return result;
}
