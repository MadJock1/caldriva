import { z } from "zod";

export const BUILDING_FILES_BUCKET = "building-files";
export const MAX_FILE_BYTES = 10_485_760;
export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/vnd.dwg",
  "image/vnd.dxf",
  "application/dxf",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export const buildingFileIdSchema = z.uuid();
export const buildingFileRowSchema = z.object({
  id: buildingFileIdSchema,
  building_id: z.uuid(),
  file_name: z.string().min(1).max(255),
  mime_type: z.enum(ALLOWED_FILE_TYPES),
  byte_size: z.number().int().positive().max(MAX_FILE_BYTES),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  created_at: z.string(),
});
export type BuildingFileRow = z.infer<typeof buildingFileRowSchema>;

const TYPE_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "PNG image",
  "image/jpeg": "JPEG image",
  "image/webp": "WebP image",
  "image/vnd.dwg": "AutoCAD DWG",
  "image/vnd.dxf": "DXF drawing",
  "application/dxf": "DXF drawing",
  "text/csv": "CSV",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
};

/** Deterministic storage path: "<owner>/<building>/<file>". Mirrors register_building_file. */
export function buildingFilePath(ownerId: string, buildingId: string, fileId: string) {
  return `${ownerId}/${buildingId}/${fileId}`;
}

export function fileTypeLabel(mime: string) {
  return TYPE_LABELS[mime] ?? mime;
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"] as const;
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? Math.round(value) : Math.round(value * 10) / 10} ${units[unit]}`;
}
