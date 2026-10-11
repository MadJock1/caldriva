import { describe, expect, it } from "vitest";
import { AuthorizedCatalogProvider, emptyCatalogNotice, validateCatalogRecord } from "./catalog";

const verifiedRecord = {
  reference: "5SY6116-7",
  manufacturer: "Siemens",
  productName: "Miniature circuit breaker 1P B16",
  category: "protective_device",
  source: "manual_authorized_import",
  sourceUrl: "https://www.siemens.com/lowvoltage/cax",
  retrievedAt: "2026-10-11T00:00:00.000Z",
  lifecycleStatus: "unknown",
  verificationStatus: "verified_source_record",
  attributes: [{ name: "ratedCurrent", value: 16, unit: "A", source: "manual_authorized_import" }],
  documents: [{ id: "datasheet", type: "datasheet", title: "Manufacturer datasheet", url: "https://www.siemens.com/lowvoltage/cax", language: "en", source: "manual_authorized_import", retrievedAt: "2026-10-11T00:00:00.000Z" }],
};

describe("electrical manufacturer catalog", () => {
  it("starts empty instead of bundling unverified product data", () => {
    const provider = new AuthorizedCatalogProvider();
    expect(provider.getStatus()).toEqual({ recordCount: 0, manufacturers: [], categories: [], notice: emptyCatalogNotice });
  });

  it("rejects records that are not explicitly verified source records", () => {
    const validation = validateCatalogRecord({ ...verifiedRecord, verificationStatus: "imported_unreviewed" });
    expect(validation.success).toBe(false);
    if (!validation.success) expect(validation.issues).toContain("verificationStatus must be verified_source_record for import into the active catalog");
  });

  it("imports and searches authorized records without inventing extra fields", async () => {
    const provider = new AuthorizedCatalogProvider();
    const result = await provider.importAuthorizedCatalog([verifiedRecord, { reference: "bad" }]);
    expect(result.imported).toBe(1);
    expect(result.rejected).toHaveLength(1);

    await expect(provider.getProduct("5sy6116-7")).resolves.toMatchObject({ reference: "5SY6116-7", manufacturer: "Siemens" });
    await expect(provider.searchProducts("b16", { manufacturer: "Siemens" })).resolves.toHaveLength(1);
    await expect(provider.getTechnicalAttributes("5SY6116-7")).resolves.toMatchObject([{ name: "ratedCurrent", value: 16, unit: "A" }]);
    await expect(provider.listAvailableDocuments("5SY6116-7")).resolves.toMatchObject([{ type: "datasheet" }]);
  });
});
