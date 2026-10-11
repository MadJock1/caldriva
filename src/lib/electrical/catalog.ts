import { z } from "zod";

export const catalogRecordSourceSchema = z.enum([
  "manufacturer_official",
  "authorized_distributor",
  "eplan_data_portal",
  "manual_authorized_import",
]);

export const catalogDocumentTypeSchema = z.enum([
  "datasheet",
  "manual",
  "certificate",
  "declaration_of_conformity",
  "cad_2d",
  "cad_3d",
  "wiring_diagram",
  "installation_guide",
]);

export const manufacturerDocumentSchema = z.object({
  id: z.string().min(1).max(128),
  type: catalogDocumentTypeSchema,
  title: z.string().min(1).max(256),
  url: z.string().url(),
  language: z.string().min(2).max(16).default("en"),
  revision: z.string().max(64).optional(),
  source: catalogRecordSourceSchema,
  retrievedAt: z.string().datetime(),
});
export type ManufacturerDocument = z.infer<typeof manufacturerDocumentSchema>;

export const technicalAttributeSchema = z.object({
  name: z.string().min(1).max(128),
  value: z.union([z.string(), z.number(), z.boolean()]),
  unit: z.string().max(32).optional(),
  source: catalogRecordSourceSchema,
});
export type TechnicalAttribute = z.infer<typeof technicalAttributeSchema>;

export const manufacturerPartSchema = z.object({
  reference: z.string().min(1).max(128),
  manufacturer: z.string().min(1).max(128),
  manufacturerId: z.string().min(1).max(128).optional(),
  productName: z.string().min(1).max(256),
  productFamily: z.string().max(128).optional(),
  category: z.string().min(1).max(128),
  description: z.string().max(1000).optional(),
  source: catalogRecordSourceSchema,
  sourceUrl: z.string().url(),
  retrievedAt: z.string().datetime(),
  attributes: z.array(technicalAttributeSchema).default([]),
  documents: z.array(manufacturerDocumentSchema).default([]),
  lifecycleStatus: z.enum(["active", "discontinued", "unknown"]).default("unknown"),
  verificationStatus: z.enum(["verified_source_record", "imported_unreviewed", "rejected"]),
  notes: z.string().max(1000).optional(),
});
export type ManufacturerPart = z.infer<typeof manufacturerPartSchema>;

export interface CatalogSearchFilters {
  manufacturer?: string;
  category?: string;
  source?: z.infer<typeof catalogRecordSourceSchema>;
}

export interface CatalogProvider {
  searchProducts(query: string, filters?: CatalogSearchFilters): Promise<ManufacturerPart[]>;
  getProduct(reference: string): Promise<ManufacturerPart | null>;
  getTechnicalAttributes(reference: string): Promise<TechnicalAttribute[]>;
  listAvailableDocuments(reference: string): Promise<ManufacturerDocument[]>;
  importAuthorizedCatalog(data: unknown): Promise<{ imported: number; rejected: CatalogImportRejection[] }>;
  validateCatalogRecord(record: unknown): { success: true; data: ManufacturerPart } | { success: false; issues: string[] };
}

export interface CatalogImportRejection {
  index: number;
  issues: string[];
}

export const emptyCatalogNotice =
  "No verified manufacturer product records are bundled. Import authorized manufacturer/catalog data before mapping symbols to real parts.";

export class AuthorizedCatalogProvider implements CatalogProvider {
  private readonly records = new Map<string, ManufacturerPart>();

  constructor(initialRecords: unknown[] = []) {
    for (const record of initialRecords) {
      const validation = this.validateCatalogRecord(record);
      if (validation.success) this.records.set(normalizeReference(validation.data.reference), validation.data);
    }
  }

  async searchProducts(query: string, filters: CatalogSearchFilters = {}): Promise<ManufacturerPart[]> {
    const normalizedQuery = query.trim().toLowerCase();
    return Array.from(this.records.values()).filter((record) => {
      if (filters.manufacturer && record.manufacturer.toLowerCase() !== filters.manufacturer.toLowerCase()) return false;
      if (filters.category && record.category.toLowerCase() !== filters.category.toLowerCase()) return false;
      if (filters.source && record.source !== filters.source) return false;
      if (!normalizedQuery) return true;
      return [record.reference, record.manufacturer, record.productName, record.productFamily, record.category, record.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }

  async getProduct(reference: string): Promise<ManufacturerPart | null> {
    return this.records.get(normalizeReference(reference)) ?? null;
  }

  async getTechnicalAttributes(reference: string): Promise<TechnicalAttribute[]> {
    return (await this.getProduct(reference))?.attributes ?? [];
  }

  async listAvailableDocuments(reference: string): Promise<ManufacturerDocument[]> {
    return (await this.getProduct(reference))?.documents ?? [];
  }

  async importAuthorizedCatalog(data: unknown): Promise<{ imported: number; rejected: CatalogImportRejection[] }> {
    const records = Array.isArray(data) ? data : [data];
    const rejected: CatalogImportRejection[] = [];
    let imported = 0;

    records.forEach((record, index) => {
      const validation = this.validateCatalogRecord(record);
      if (!validation.success) {
        rejected.push({ index, issues: validation.issues });
        return;
      }
      this.records.set(normalizeReference(validation.data.reference), validation.data);
      imported += 1;
    });

    return { imported, rejected };
  }

  validateCatalogRecord(record: unknown): { success: true; data: ManufacturerPart } | { success: false; issues: string[] } {
    const parsed = manufacturerPartSchema.safeParse(record);
    if (!parsed.success) return { success: false, issues: parsed.error.issues.map((issue) => `${issue.path.join(".") || "record"}: ${issue.message}`) };
    if (parsed.data.verificationStatus !== "verified_source_record") {
      return { success: false, issues: ["verificationStatus must be verified_source_record for import into the active catalog"] };
    }
    return { success: true, data: parsed.data };
  }

  getStatus() {
    const records = Array.from(this.records.values());
    return {
      recordCount: records.length,
      manufacturers: Array.from(new Set(records.map((record) => record.manufacturer))).sort(),
      categories: Array.from(new Set(records.map((record) => record.category))).sort(),
      notice: records.length === 0 ? emptyCatalogNotice : "Catalog contains authorized imported manufacturer records.",
    };
  }
}

export const defaultCatalogProvider = new AuthorizedCatalogProvider();

export function validateCatalogRecord(record: unknown) {
  return defaultCatalogProvider.validateCatalogRecord(record);
}

export function normalizeReference(reference: string) {
  return reference.trim().toUpperCase();
}
