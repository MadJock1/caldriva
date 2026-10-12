import { z } from "zod";

export const panelModelSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(160),
  watts: z.number().min(10).max(1000),
  widthM: z.number().min(0.2).max(5),
  lengthM: z.number().min(0.2).max(5),
  verified: z.boolean(),
  provenance: z.string().min(1).max(300),
});
export type PanelModel = z.infer<typeof panelModelSchema>;

// Illustrative reference models only. No manufacturer product data is bundled and every entry is
// explicitly unverified, so the UI always surfaces the "unverified" warning. Verified records must
// be imported from an authorized manufacturer/catalogue source before being treated as confirmed.
export const panelCatalogue: readonly PanelModel[] = [
  { id: "example-mono-430", label: "Example 430 W monocrystalline", watts: 430, widthM: 1.13, lengthM: 1.76, verified: false, provenance: "Illustrative reference model; not a verified manufacturer record." },
  { id: "example-mono-450", label: "Example 450 W monocrystalline", watts: 450, widthM: 1.13, lengthM: 1.82, verified: false, provenance: "Illustrative reference model; not a verified manufacturer record." },
  { id: "example-bifacial-550", label: "Example 550 W bifacial", watts: 550, widthM: 1.13, lengthM: 2.28, verified: false, provenance: "Illustrative reference model; not a verified manufacturer record." },
  { id: "example-compact-360", label: "Example 360 W compact", watts: 360, widthM: 1.0, lengthM: 1.7, verified: false, provenance: "Illustrative reference model; not a verified manufacturer record." },
];

export const defaultPanelModelId = panelCatalogue[0].id;

export function panelModelById(id: string): PanelModel | undefined {
  return panelCatalogue.find(model => model.id === id);
}

export const PANEL_CATALOGUE_DISCLAIMER = "Catalogue entries are illustrative and unverified. Confirm module dimensions, power and datasheet values before procurement, design or permitting.";
