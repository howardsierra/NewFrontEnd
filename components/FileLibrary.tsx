"use client";
import { useEffect, useMemo, useState } from "react";
import { Files, Search, X, Upload, MessageSquare, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { collectLibraryFiles } from "@/lib/file-library";
import { GeneratedFile } from "./GeneratedFile";
import { ZipDownload } from "./ZipDownload";

export function FileLibrary({ onClose }: { onClose: () => void }) {
  const conversations = useStore((state) => state.conversations);
  const kept = useStore((state) => state.libraryFiles);
  const remove = useStore((state) => state.removeLibraryFile);
  const setActive = useStore((state) => state.setActive);
  const files = useMemo(() => collectLibraryFiles(conversations, kept), [conversations, kept]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [active, setActiveFile] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const lower = query.trim().toLowerCase();
  const fileType = (name: string) => name.includes(".") ? name.split(".").pop()!.toLowerCase() : "txt";
  const visible = files.filter((file) => {
    const latest = file.versions[file.versions.length - 1];
    return (!type || fileType(latest.filename) === type) && (!lower || [latest.path ?? latest.filename, latest.content, file.origin?.title ?? ""].some((text) => text.toLowerCase().includes(lower)));
  });
  const current = visible.find((file) => file.id === active) ?? visible[0];
  const latest = current?.versions[current.versions.length - 1];
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", close);
    document.addEventListener("revise-file", onClose);
    return () => { document.removeEventListener("keydown", close); document.removeEventListener("revise-file", onClose); };
  }, [onClose]);
  return <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 p-0 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="File library">
    <div className="card flex w-full max-w-6xl flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line px-5 py-5"><Files size={20} className="text-accent-soft" /><div className="flex-1"><h2 className="font-display text-lg font-semibold">File library</h2><p className="mt-1 text-xs text-ink-muted">Documents and code across your chats. Keep copies to retain them after deleting a chat.</p></div><button className="btn-ghost px-2" aria-label="Close file library" onClick={onClose}><X size={18} /></button></div>
      <div className="flex flex-wrap items-center gap-3 border-b border-line/70 bg-bg-subtle/30 p-4">
        <label className="relative min-w-40 flex-1"><Search size={14} className="absolute left-3 top-3 text-ink-faint" /><input autoFocus className="input pl-9" aria-label="Search files" placeholder="Search names, content, or chats" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <select className="input w-auto" aria-label="File type" value={type} onChange={(event) => setType(event.target.value)}><option value="">All types</option>{[...new Set(files.map((file) => fileType(file.versions[file.versions.length - 1].filename)))].sort().map((ext) => <option key={ext}>{ext}</option>)}</select>
        <label className="btn-soft cursor-pointer text-xs"><Upload size={14} />Upload to revise<input className="hidden" type="file" multiple onChange={(event) => {
          const input = document.querySelector<HTMLInputElement>('main input[type="file"]');
          if (input && event.target.files) { input.files = event.target.files; input.dispatchEvent(new Event("change", { bubbles: true })); }
          onClose();
        }} /></label>
      </div>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="max-h-[32vh] w-full shrink-0 overflow-y-auto border-b border-line bg-bg-subtle/40 p-3 md:max-h-none md:w-80 md:border-b-0 md:border-r">
          <p className="mb-2 text-xs text-ink-faint">{visible.length} files · {files.filter((file) => selected.includes(file.id)).length} selected</p>
          <ZipDownload name="file-library" files={files.filter((file) => selected.includes(file.id)).map((file) => file.versions[file.versions.length - 1])} />
          {!visible.length && <p role="status" className="py-8 text-center text-sm text-ink-muted">{files.length ? "No files match your search." : "Ask the AI to create a file, or upload a document to get started."}</p>}
          {visible.map((file) => {
            const version = file.versions[file.versions.length - 1];
            return <div key={file.id} className={`mb-1 flex items-start gap-2 rounded-xl p-3 ${current?.id === file.id ? "bg-accent/[0.08] ring-1 ring-accent/15" : "hover:bg-overlay/5"}`}>
              <input className="mt-1 accent-accent" type="checkbox" aria-label={`Select ${version.path ?? version.filename}`} checked={selected.includes(file.id)} onChange={(event) => setSelected((ids) => event.target.checked ? [...ids, file.id] : ids.filter((id) => id !== file.id))} />
              <button className="min-w-0 flex-1 text-left" onClick={() => setActiveFile(file.id)}><span className="block truncate text-sm font-medium">{version.path ?? version.filename}</span><span className="mt-1 block truncate text-xs text-ink-muted">{kept.some((item) => item.id === file.id) ? "Kept copy" : file.origin?.uploaded ? "Extracted upload" : "From chat"} · {file.versions.length} version{file.versions.length === 1 ? "" : "s"}</span></button>
            </div>;
          })}
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-bg/60 p-4 sm:p-6">
          {current && latest ? <>
            <div className="mb-3 flex flex-wrap gap-2 text-xs text-ink-muted">
              {current.origin?.uploaded && <p>Editable text extracted from an upload. Original document layout and embedded media are not retained.</p>}
              {current.origin && conversations.some((conversation) => conversation.id === current.origin?.conversationId) && <button className="btn-ghost text-xs" onClick={() => { setActive(current.origin!.conversationId); onClose(); }}><MessageSquare size={13} />Open source chat</button>}
              {kept.some((file) => file.id === current.id) && <button className="btn-ghost text-xs" onClick={() => { if (window.confirm("Remove the kept copy and its saved versions? Files still present in chats remain discoverable.")) remove(current.id); }}><Trash2 size={13} />Remove kept copy</button>}
            </div>
            <GeneratedFile key={current.id} filename={latest.filename} content={latest.content} record={current} />
          </> : <div className="grid h-full min-h-32 place-items-center text-sm text-ink-muted">Your files will appear here.</div>}
        </div>
      </div>
    </div>
  </div>;
}
