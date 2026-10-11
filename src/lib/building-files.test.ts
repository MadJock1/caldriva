import { describe, expect, it } from "vitest";
import { ALLOWED_FILE_TYPES, MAX_FILE_BYTES, buildingFilePath, buildingFileRowSchema, fileTypeLabel, formatBytes } from "./building-files";

const buildingId = "11111111-1111-4111-8111-111111111111";
const fileId = "22222222-2222-4222-8222-222222222222";
const row = {
  id: fileId,
  building_id: buildingId,
  file_name: "roof-plan.pdf",
  mime_type: "application/pdf",
  byte_size: 2048,
  sha256: "a".repeat(64),
  created_at: "2026-01-01T00:00:00Z",
};

describe("building file helpers", () => {
  it("formats byte sizes for display", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(MAX_FILE_BYTES)).toBe("10 MB");
    expect(formatBytes(-1)).toBe("0 B");
  });
  it("builds the owner/building/file storage path", () => {
    expect(buildingFilePath("owner", buildingId, fileId)).toBe(`owner/${buildingId}/${fileId}`);
  });
  it("labels known MIME types and falls back to the raw type", () => {
    expect(fileTypeLabel("application/pdf")).toBe("PDF");
    expect(fileTypeLabel("application/octet-stream")).toBe("application/octet-stream");
    expect(ALLOWED_FILE_TYPES).toContain("application/pdf");
  });
  it("accepts a well-formed row and rejects bad size or type", () => {
    expect(buildingFileRowSchema.safeParse(row).success).toBe(true);
    expect(buildingFileRowSchema.safeParse({ ...row, byte_size: MAX_FILE_BYTES + 1 }).success).toBe(false);
    expect(buildingFileRowSchema.safeParse({ ...row, byte_size: 0 }).success).toBe(false);
    expect(buildingFileRowSchema.safeParse({ ...row, mime_type: "application/zip" }).success).toBe(false);
    expect(buildingFileRowSchema.safeParse({ ...row, sha256: "xyz" }).success).toBe(false);
  });
});
