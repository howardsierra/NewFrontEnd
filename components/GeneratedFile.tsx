"use client";

import { CodePreview } from "./CodePreview";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Download, FileText, Loader2, Pencil, BookmarkPlus, MoreHorizontal, Code2 } from "lucide-react";
import { downloadBlob, exportFilename } from "@/lib/download";
import { generatedFileFormat, safeProjectPath } from "@/lib/generated-files";
import { makeLibraryFile, type LibraryFile, type FileVersion } from "@/lib/file-library";
import { useStore } from "@/lib/store";

export function GeneratedFile({ filename, content, record, pending = false }: { filename: string; content: string; record?: LibraryFile; pending?: boolean }) {
  const actionsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (actionsRef.current?.open && !actionsRef.current.contains(event.target as Node)) actionsRef.current.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  const base = record ?? makeLibraryFile(`manual:${filename}`, filename, content, Date.now());
  const kept = useStore((state) => state.libraryFiles.find((file) => file.id === base.id));
  const keep = useStore((state) => state.keepLibraryFile);
  const saveVersion = useStore((state) => state.saveFileVersion);
  const file = kept ?? base;
  const [selected, setSelected] = useState(file.versions[file.versions.length - 1].id);
  const version = file.versions.find((item) => item.id === selected) ?? file.versions[file.versions.length - 1];
  const [draft, setDraft] = useState(version.content);
  const [name, setName] = useState(version.path ?? version.filename);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const extension = /\.([a-z0-9]+)$/i.exec(name)?.[1] || "txt";
  const actualName = safeProjectPath(name)?.split("/").pop() || exportFilename(name.split(/[\\/]/).pop() || name, extension, "document");
  const dirty = draft !== version.content || name !== (version.path ?? version.filename);
  let format = "";
  try { format = generatedFileFormat(actualName); } catch { /* Display the unsupported format below. */ }
  const select = (item: FileVersion) => { setSelected(item.id); setDraft(item.content); setName(item.path ?? item.filename); setError(""); setNotice(""); };
  const save = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const { createDocument } = await import("@/lib/documents");
      downloadBlob(await createDocument(actualName, draft), actualName);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create this file. Try again."); }
    finally { setBusy(false); }
  };
  const closeActions = (target: HTMLElement) => target.closest("details")?.removeAttribute("open");
  const revise = () => {
    document.dispatchEvent(new CustomEvent("revise-file", { detail: { filename: name, content: draft, fileId: file.id } }));
    setNotice("File attached to the composer. Describe your changes, then send.");
  };
  return (
    <section aria-label={`Generated file: ${filename}`} className="file-card my-4 rounded-2xl p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="file-kind">{["pdf", "docx", "md", "markdown", "txt"].includes(format) ? <FileText size={18} strokeWidth={1.5} /> : <Code2 size={18} strokeWidth={1.5} />}<span className="text-[9px] font-semibold uppercase tracking-wider">{format || extension}</span></span>
        <div className="min-w-0 flex-1 pt-0.5"><p className="break-all text-sm font-semibold text-ink">{name}</p><p className="mt-1 text-xs leading-relaxed text-ink-muted">{pending ? "Waiting for the reply to finish" : format ? `${dirty ? "Unsaved edits · " : ""}${kept ? "Kept in library" : base.id.startsWith("manual:") ? "Keep this file to add it to File library" : "Available in File library"}` : "Unsupported format. Ask for PDF, DOCX, or a text/code file."}</p></div>
        <div className="flex shrink-0 items-center gap-1">
          <button className="btn-primary text-xs" disabled={busy || !format || pending} onClick={save} aria-label={`Download ${actualName}`}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}{busy ? "Creating…" : "Download"}</button>
          <details ref={actionsRef} className="file-actions relative" onKeyDown={(event) => { if (event.key === "Escape" && event.currentTarget.open) { event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}>
            <summary aria-label={`File actions for ${filename}`} title="More file actions"><MoreHorizontal size={19} /></summary>
            <div className="file-actions-panel">
              {!kept && <button className="btn-ghost" disabled={pending || dirty} onClick={(event) => {
                closeActions(event.currentTarget);
                try { keep(base); setNotice("Kept in File library. This copy stays even if its chat is deleted."); setError(""); }
                catch (cause) { setError(cause instanceof Error ? cause.message : "Could not keep this file."); }
              }}><BookmarkPlus size={14} />Keep in library</button>}
              <button className="btn-ghost" disabled={pending} onClick={(event) => { closeActions(event.currentTarget); revise(); }}><Pencil size={14} />Revise with AI</button>
              <button className="btn-ghost" onClick={(event) => { closeActions(event.currentTarget); setEditorOpen(true); setEditing(true); }}><Code2 size={14} />View source</button>
            </div>
          </details>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="btn-soft px-3 text-xs" aria-expanded={editorOpen} onClick={() => setEditorOpen(!editorOpen)}><Pencil size={13} />Preview &amp; edit</button>
        {file.versions.length > 1 && <label className="ml-auto flex max-w-full items-center gap-2 text-xs text-ink-muted">Version<select aria-label={`Version of ${filename}`} className="input max-w-[12rem] w-auto py-1" value={version.id} onChange={(event) => {
          if (dirty && !window.confirm("Discard unsaved edits and switch versions?")) return;
          select(file.versions.find((item) => item.id === event.target.value)!);
        }}>{file.versions.map((item, index) => <option value={item.id} key={item.id}>v{index + 1} · {item.filename}</option>)}</select></label>}
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-red-400">{error}</p>}
      {notice && <p role="status" className="mt-2 text-xs text-ink-muted">{notice}</p>}
      {editorOpen && <div className="mt-4 border-t border-line/70 pt-4">
        <label className="block text-xs text-ink-muted">Filename or project path<input aria-label="File name or path" className="input mt-2" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <div className="my-3 flex gap-2"><button className={editing ? "btn-ghost text-xs" : "btn-soft text-xs"} aria-pressed={!editing} onClick={() => setEditing(false)}>Preview</button><button className={editing ? "btn-soft text-xs" : "btn-ghost text-xs"} aria-pressed={editing} onClick={() => setEditing(true)}>Edit content</button></div>
        {editing ? <textarea aria-label={`Edit content of ${filename}`} className="input min-h-64 resize-y font-mono text-[13px] leading-7" value={draft} onChange={(event) => setDraft(event.target.value)} />
          : ["pdf", "docx", "md", "markdown"].includes(format) ? <div className="document-stage"><article aria-label="Document preview" className="prose-chat document-paper"><ReactMarkdown remarkPlugins={[remarkGfm]}>{draft}</ReactMarkdown></article><p className="mt-4 text-center text-xs text-ink-muted">Document preview · Downloaded pagination may vary</p></div>
          : <CodePreview filename={actualName} content={draft} />}
        {dirty && <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className="btn-primary text-xs" disabled={pending || !format} onClick={() => {
            try {
              const path = safeProjectPath(name);
              if (!path) throw new Error("Use a relative filename or project path without parent directories.");
              const id = saveVersion(file, actualName, draft, path.includes("/") ? path : undefined);
              setSelected(id); setNotice("New version saved in File library."); setError("");
            } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this version."); }
          }}>Save new version</button>
          <button className="btn-ghost text-xs" onClick={() => select(version)}>Discard edits</button>
          <span className="text-[11px] text-ink-muted">Save a version to include edits in the library and ZIP downloads.</span>
        </div>}
      </div>}

    </section>
  );
}
