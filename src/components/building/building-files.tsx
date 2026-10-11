"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ALLOWED_FILE_TYPES, MAX_FILE_BYTES, fileTypeLabel, formatBytes, type BuildingFileRow } from "@/lib/building-files";
import { deleteBuildingFile, signBuildingFile, uploadBuildingFile } from "@/app/dashboard/buildings/files-actions";

export function BuildingFiles({ buildingId, initial }: { buildingId: string; initial: BuildingFileRow[] }) {
  const [items, setItems] = useState(initial);
  const [message, setMessage] = useState("");
  const [busy, start] = useTransition();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  const upload = () => {
    const file = input.current?.files?.[0];
    if (!file) { setMessage("Choose a file to upload."); return; }
    if (file.size > MAX_FILE_BYTES) { setMessage("Files must be 10 MB or smaller."); return; }
    start(async () => {
      try {
        const formData = new FormData();
        formData.set("buildingId", buildingId);
        formData.set("file", file);
        const response = await uploadBuildingFile(formData);
        if (response?.error) setMessage(response.error);
        else { setMessage(`Uploaded “${file.name}”.`); if (input.current) input.current.value = ""; router.refresh(); }
      } catch { setMessage("Upload failed. Please retry."); }
    });
  };

  const download = (file: BuildingFileRow) => start(async () => {
    try {
      const response = await signBuildingFile(buildingId, file.id);
      if (response?.error || !response.data) { setMessage(response?.error ?? "Download failed."); return; }
      window.open(response.data.url, "_blank", "noopener,noreferrer");
    } catch { setMessage("Download failed. Please retry."); }
  });

  const remove = (file: BuildingFileRow) => {
    if (!window.confirm(`Delete “${file.file_name}”? This removes the stored file and cannot be undone.`)) return;
    start(async () => {
      try {
        const response = await deleteBuildingFile(buildingId, file.id);
        if (response?.error) setMessage(response.error);
        else { setItems(list => list.filter(item => item.id !== file.id)); setMessage("File deleted."); router.refresh(); }
      } catch { setMessage("Delete failed. Please retry."); }
    });
  };

  return <section className="mt-8">
    <div className="border rounded-xl bg-surface p-5">
      <h2 className="text-xl font-semibold">Add a file</h2>
      <p className="mt-2 text-sm text-text-muted">PDF, image, CAD (DWG/DXF), CSV or Excel up to 10 MB. Files are private to your account and shared with staff only when linked to a quotation request.</p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="text-sm" htmlFor="building-file">File</label>
        <input ref={input} id="building-file" name="file" type="file" accept={ALLOWED_FILE_TYPES.join(",")} className="text-sm" disabled={busy} />
        <Button loading={busy} onClick={upload}>Upload file</Button>
      </div>
    </div>
    <p role="status" className="my-5">{message}</p>
    {items.length === 0 ? <p className="text-text-muted">No files attached to this building yet.</p> : <ul className="grid md:grid-cols-2 gap-5">
      {items.map(file => <li key={file.id} className="border rounded-xl bg-surface p-6">
        <h3 className="text-lg font-semibold break-words">{file.file_name}</h3>
        <p className="mt-2 text-sm text-text-muted">{fileTypeLabel(file.mime_type)} · {formatBytes(file.byte_size)} · added {file.created_at.slice(0, 10)}</p>
        <p className="mt-1 text-xs text-text-muted break-all">SHA-256 {file.sha256.slice(0, 16)}…</p>
        <div className="mt-4 flex flex-wrap gap-4 items-center">
          <Button variant="outline" disabled={busy} onClick={() => download(file)}>Download</Button>
          <Button variant="ghost" disabled={busy} onClick={() => remove(file)}>Delete</Button>
        </div>
      </li>)}
    </ul>}
  </section>;
}
