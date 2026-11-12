"use client";
import { useState } from "react";
import { Archive, Loader2 } from "lucide-react";
import type { FileVersion } from "@/lib/file-library";
import { downloadBlob, exportFilename } from "@/lib/download";

export function ZipDownload({ files, name = "project" }: { files: FileVersion[]; name?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <div className="my-2">
    <button className="btn-soft text-xs" title="Includes the latest saved version of each file" disabled={busy || !files.length} onClick={async () => {
      setBusy(true); setError("");
      try {
        const { createProjectZip } = await import("@/lib/project-zip");
        downloadBlob(await createProjectZip(files), exportFilename(name, "zip"));
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create the ZIP. Try again."); }
      finally { setBusy(false); }
    }}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />} {busy ? "Creating ZIP…" : `Download ZIP (${files.length})`}</button>
    {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
  </div>;
}
