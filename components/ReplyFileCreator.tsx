"use client";
import { makeLibraryFile, type FileOrigin } from "@/lib/file-library";
import { useState } from "react";
import { FileDown } from "lucide-react";
import { GeneratedFile } from "./GeneratedFile";
import { exportFilename } from "@/lib/download";

export function ReplyFileCreator({ content, origin, createdAt = 0 }: { content: string; origin?: FileOrigin; createdAt?: number }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("document.pdf");
  const extension = /\.([a-z0-9]+)$/i.exec(name)?.[1] || "txt";
  const filename = exportFilename(name, extension, "document");
  return (
    <div className="mt-2">
      <button className="btn-ghost px-2 text-xs" aria-expanded={open} onClick={() => setOpen(!open)}><FileDown size={14} /> Save reply as a file</button>
      {open && <div className="mt-2 rounded-xl border border-line p-3">
        <label className="block text-xs text-ink-muted">Filename (include extension)
          <input className="input mt-2" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {[["PDF", "pdf"], ["Word", "docx"], ["Markdown", "md"], ["Text", "txt"]].map(([label, format]) => <button key={format} className="btn-soft py-1 text-xs" onClick={() => setName(exportFilename(name.replace(/\.[^.]+$/, ""), format, "document"))}>{label}</button>)}
        </div>
        <GeneratedFile key={filename} filename={filename} content={content} record={makeLibraryFile(origin ? `manual:${origin.conversationId}:${origin.messageId}:${filename}` : `manual:${filename}`, filename, content, createdAt, origin)} />
      </div>}
    </div>
  );
}
