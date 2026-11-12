"use client";

import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { parseFile } from "@/lib/files";
import type { Attachment } from "@/lib/types";
import { useStore } from "@/lib/store";
import { hasPlaceholders, parsePlaceholders } from "@/lib/placeholders";
import { PlaceholderFill } from "./PlaceholderFill";
import {
  Paperclip,
  ArrowUp,
  Square,
  X,
  FileText,
  ImageIcon,
  Loader2,
  BookText,
  CornerDownLeft,
  ImagePlus,
} from "lucide-react";
import clsx from "clsx";

interface SlashState {
  start: number;
  end: number;
  query: string;
}

type InsertTarget = { kind: "append" } | { kind: "at"; pos: number };

interface PendingFill {
  body: string;
  target: InsertTarget;
}

export function Composer({
  conversationId,
  busy,
  disabled,
  onSend,
  onStop,
  onGenerateImage,
  imageWarning,
}: {
  conversationId: string;
  busy: boolean;
  disabled: boolean;
  onSend: (text: string, attachments: Attachment[], revisionOf?: string) => void;
  onStop: () => void;
  onGenerateImage: (prompt: string, size: string) => void;
  /** Shown when an image is attached but the selected model can't see images. */
  imageWarning?: string;
}) {
  const [text, setText] = useState(() => {
    try { return sessionStorage.getItem(`flux-draft:${conversationId}`) ?? ""; }
    catch { return ""; }
  });
  useEffect(() => {
    try {
      if (text) sessionStorage.setItem(`flux-draft:${conversationId}`, text);
      else sessionStorage.removeItem(`flux-draft:${conversationId}`);
    } catch { /* Drafts remain available in memory when storage is unavailable. */ }
    const el = textarea.current;
    if (el) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 260) + "px"; }
  }, [text, conversationId]);
  const [revisionOf, setRevisionOf] = useState<string | undefined>();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [parsing, setParsing] = useState(false);
  const parsingRef = useRef(false);
  const attachmentsRef = useRef<Attachment[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const preview = attachments.find((attachment) => attachment.id === previewId);
  const [dragOver, setDragOver] = useState(false);
  const [slash, setSlash] = useState<SlashState | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [pendingFill, setPendingFill] = useState<PendingFill | null>(null);
  const [imageMode, setImageMode] = useState(false);
  const [imageSize, setImageSize] = useState("1024x1024");
  // Bumped on each send to replay the send-button ripple.
  const [launchKey, setLaunchKey] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const snippets = useStore((s) => s.snippets);

  // Snippets matching the current "/query" the user is typing.
  const slashMatches = slash
    ? snippets
        .filter((s) =>
          slash.query
            ? s.title.toLowerCase().includes(slash.query.toLowerCase())
            : true
        )
        .slice(0, 6)
    : [];

  /** Insert text either appended to the end or at a specific index. */
  const doInsert = (str: string, target: InsertTarget) => {
    setText((prev) => {
      let next: string;
      let caret: number;
      if (target.kind === "append") {
        const insert = (prev.trim() ? "\n\n" : "") + str;
        next = prev + insert;
        caret = next.length;
      } else {
        const pos = Math.min(target.pos, prev.length);
        next = prev.slice(0, pos) + str + prev.slice(pos);
        caret = pos + str.length;
      }
      requestAnimationFrame(() => {
        const el = textarea.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(caret, caret);
        autoGrow();
      });
      return next;
    });
  };

  /** Route a snippet through the placeholder fill panel if it has {{vars}}. */
  const chooseSnippet = (body: string, target: InsertTarget) => {
    if (hasPlaceholders(body)) setPendingFill({ body, target });
    else doInsert(body, target);
  };

  // Library "Insert" appends a snippet to the composer.
  useEffect(() => {
    const handler = (e: Event) => {
      const body = (e as CustomEvent<string>).detail;
      if (typeof body !== "string") return;
      chooseSnippet(body, { kind: "append" });
    };
    document.addEventListener("insert-snippet", handler);
    return () => document.removeEventListener("insert-snippet", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const revise = (event: Event) => {
      const detail = (event as CustomEvent<{ filename: string; content: string; fileId?: string }>).detail;
      if (!detail || typeof detail.filename !== "string" || typeof detail.content !== "string") return;
      if (parsingRef.current) { setFileErrors(["Wait for attachments to finish loading before revising another file."]); return; }
      const attachment: Attachment = { id: nanoid(), name: detail.filename, kind: "text", mime: "text/plain", text: detail.content, size: new TextEncoder().encode(detail.content).byteLength };
      const existing = attachmentsRef.current.some((item) => item.name === attachment.name && item.text === attachment.text);
      const next = existing ? attachmentsRef.current : [...attachmentsRef.current, attachment];
      if (next.length > 10 || new TextEncoder().encode(JSON.stringify(next)).byteLength > 3_500_000) { setFileErrors(["Remove an attachment or use a smaller file before starting this revision."]); return; }
      attachmentsRef.current = next;
      setAttachments(next);
      setImageMode(false);
      setRevisionOf(typeof detail.fileId === "string" ? detail.fileId : undefined);
      setText((previous) => `${previous.trim() ? previous + "\n\n" : ""}Revise ${detail.filename} and return the complete updated file in the same format. Changes: `);
      textarea.current?.focus();
    };
    document.addEventListener("revise-file", revise);
    return () => document.removeEventListener("revise-file", revise);
  }, []);

  /** Detect an in-progress "/command" immediately before the caret. */
  const updateSlash = (value: string, caret: number) => {
    const before = value.slice(0, caret);
    const m = before.match(/(?:^|\s)\/([^\s/]*)$/);
    if (m) {
      setSlash({ start: caret - m[1].length - 1, end: caret, query: m[1] });
      setSlashIndex(0);
    } else {
      setSlash(null);
    }
  };

  const applySnippet = (body: string) => {
    if (!slash) return;
    const pos = slash.start;
    // Drop the "/query" the user typed, then insert (or open the fill panel).
    setText((prev) => prev.slice(0, slash.start) + prev.slice(slash.end));
    setSlash(null);
    chooseSnippet(body, { kind: "at", pos });
  };

  const handleFiles = async (files: FileList | File[]) => {
    if (imageMode) { setFileErrors(["Switch to chat mode before attaching files. Image generation uses your prompt only."]); return; }
    if (parsingRef.current) { setFileErrors((errors) => [...errors, "Files are still being read. Wait for them to finish before adding more."]); return; }
    parsingRef.current = true;
    setParsing(true);
    setFileErrors([]);
    try {
      for (const file of Array.from(files)) {
        try {
          if (attachmentsRef.current.length >= 10) throw new Error("You can attach up to 10 files per message. Remove a file before adding more.");
          const attachment = await parseFile(file);
          const next = [...attachmentsRef.current, attachment];
          if (new TextEncoder().encode(JSON.stringify(next)).byteLength > 3_500_000) {
            throw new Error(`${file.name}: combined attachments are too large. Keep the total under 3.5 MB after processing.`);
          }
          attachmentsRef.current = next;
          setAttachments(next);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not read this file.";
          setFileErrors((errors) => [...errors, message.includes(file.name) ? message : `${file.name}: ${message}`]);
        }
      }
    } finally {
      parsingRef.current = false;
      setParsing(false);
    }
  };

  const submit = () => {
    if (disabled || busy || parsingRef.current) return;
    if (imageMode) {
      if (!text.trim()) return;
      onGenerateImage(text.trim(), imageSize);
      setLaunchKey((k) => k + 1);
      setText("");
      if (textarea.current) textarea.current.style.height = "auto";
      return;
    }
    if (!text.trim() && attachments.length === 0) return;
    onSend(text.trim(), attachments, revisionOf);
    setRevisionOf(undefined);
    setLaunchKey((k) => k + 1);
    setText("");
    attachmentsRef.current = [];
    setAttachments([]);
    setPreviewId(null);
    setFileErrors([]);
    if (textarea.current) textarea.current.style.height = "auto";
  };

  const autoGrow = () => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 260) + "px";
  };

  return (
    <div className="px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1 sm:px-6 sm:pb-4">
      <div
        className={clsx(
          "glass relative mx-auto max-w-3xl rounded-[20px] p-2.5 transition-all duration-200 focus-within:ring-accent/30 focus-within:shadow-soft",
          dragOver && "border-accent shadow-glow"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
      >
        {/* Placeholder fill-in panel (takes priority over the slash menu) */}
        {pendingFill && (
          <PlaceholderFill
            body={pendingFill.body}
            variables={parsePlaceholders(pendingFill.body)}
            onSubmit={(filled) => {
              doInsert(filled, pendingFill.target);
              setPendingFill(null);
            }}
            onCancel={() => setPendingFill(null)}
          />
        )}

        {/* Slash-command snippet menu */}
        {!pendingFill && slash && slashMatches.length > 0 && (
          <div className="absolute bottom-full left-2 right-2 mb-2 overflow-hidden rounded-xl border border-line bg-bg-panel shadow-2xl animate-fade-in">
            <div className="flex items-center gap-1.5 border-b border-line px-3 py-1.5 text-[11px] text-ink-faint">
              <BookText size={12} /> Snippets · ↑↓ to navigate · ⏎ to insert
            </div>
            {slashMatches.map((s, i) => (
              <button
                key={s.id}
                onMouseEnter={() => setSlashIndex(i)}
                onClick={() => applySnippet(s.body)}
                className={clsx(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                  i === slashIndex ? "bg-bg-elevated text-ink" : "text-ink-muted"
                )}
              >
                <CornerDownLeft size={13} className="shrink-0 opacity-50" />
                <span className="shrink-0 font-medium">{s.title}</span>
                <span className="truncate text-xs text-ink-faint">
                  {s.body.replace(/\s+/g, " ")}
                </span>
              </button>
            ))}
          </div>
        )}

        {parsing && <p role="status" className="px-3 py-2 text-xs text-ink-muted">Reading attachments…</p>}
        {fileErrors.length > 0 && (
          <div role="alert" aria-label="Attachment errors" className="mx-1 mb-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-ink">
            <div className="flex items-center justify-between gap-2"><strong>Some files could not be attached</strong>
              <button aria-label="Dismiss file errors" onClick={() => setFileErrors([])}><X size={14} /></button></div>
            <ul className="mt-2 list-disc space-y-1 pl-4">{fileErrors.map((error, i) => <li key={i}>{error}</li>)}</ul>
          </div>
        )}
        {imageWarning && attachments.some((a) => a.kind === "image") && (
          <div className="mx-1 mb-1 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-500">
            <ImageIcon size={14} className="mt-0.5 shrink-0" />
            <span>{imageWarning}</span>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2">
            {attachments.map((a) => (
              <div
                key={a.id}
                className="group/att relative flex items-center gap-2 rounded-lg border border-line bg-bg-elevated px-2.5 py-1.5 text-xs"
              >
                {a.kind === "image" && a.dataUrl ? (
                  <img src={a.dataUrl} alt="" className="h-8 w-8 rounded object-cover" />
                ) : a.kind === "image" ? (
                  <ImageIcon size={14} className="text-accent-soft" />
                ) : (
                  <FileText size={14} className="text-accent-soft" />
                )}
                <button className="text-left leading-tight" aria-label={`Preview ${a.name}`} onClick={() => setPreviewId(previewId === a.id ? null : a.id)}>
                  <div className="max-w-[140px] truncate text-ink">{a.name}</div>
                  <div className="text-[10px] text-ink-faint">
                    {a.kind === "text"
                      ? `${a.text?.length ?? 0} chars`
                      : `${(a.size / 1024).toFixed(0)} KB`}
                  </div>
                </button>
                <button
                  aria-label={`Remove ${a.name}`}
                  className="ml-1 text-ink-faint hover:text-red-400"
                  onClick={() => {
                    const next = attachmentsRef.current.filter((x) => x.id !== a.id);
                    attachmentsRef.current = next;
                    setAttachments(next);
                    setRevisionOf(undefined);
                    if (previewId === a.id) setPreviewId(null);
                  }}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {preview && (
          <section aria-label={`Attachment preview: ${preview.name}`} className="m-2 overflow-hidden rounded-xl border border-line bg-bg-panel">
            <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2 text-xs"><span className="truncate font-medium">{preview.name}</span>
              <button aria-label="Close attachment preview" onClick={() => setPreviewId(null)}><X size={14} /></button></div>
            {preview.kind === "text" ? <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs text-ink-muted">{preview.text?.slice(0, 12000)}</pre>
              : <img src={preview.dataUrl} alt={preview.name} className="max-h-52 max-w-full object-contain p-2" />}
            {preview.kind === "text" && <div className="border-t border-line p-2">
              <button className="btn-soft text-xs" onClick={() => document.dispatchEvent(new CustomEvent("revise-file", { detail: { filename: preview.name, content: preview.text ?? "" } }))}>Revise this file with AI</button>
              {/\.(pdf|docx)$/i.test(preview.name) && <p className="mt-2 text-[11px] text-ink-muted">Revisions use extracted text. Original layout and embedded media are not retained.</p>}
            </div>}
            {preview.kind === "text" && (preview.text?.length ?? 0) > 12000 && <p className="border-t border-line p-2 text-[11px] text-ink-faint">Preview shows the first 12,000 characters. The full text is attached.</p>}
          </section>
        )}
        {imageMode && (
          <div className="mx-1 mb-1 flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs text-accent-soft">
            <ImagePlus size={14} />
            <span className="font-medium">Image generation</span>
            <select
              value={imageSize}
              onChange={(e) => setImageSize(e.target.value)}
              className="ml-auto rounded-md border border-line bg-bg-panel px-1.5 py-0.5 text-[11px] text-ink outline-none"
            >
              <option>1024x1024</option>
              <option>1536x1024</option>
              <option>1024x1536</option>
            </select>
            <button className="text-ink-faint hover:text-ink" onClick={() => setImageMode(false)} aria-label="Exit image mode">
              <X size={13} />
            </button>
          </div>
        )}

        <div className="flex items-end gap-1 sm:gap-2">
          <button
            className="btn-ghost shrink-0 px-2"
            onClick={() => fileInput.current?.click()}
            title="Attach files (html, css, js, json, pdf, images…)"
            aria-label="Attach files"
            disabled={imageMode || parsing}
          >
            {parsing ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Paperclip size={18} />
            )}
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            className="btn-ghost shrink-0 px-2"
            onClick={() => document.dispatchEvent(new CustomEvent("open-snippets"))}
            title="Prompt & snippet library (or type / )"
            aria-label="Open snippet library"
          >
            <BookText size={18} />
          </button>
          <button
            className={clsx("btn-ghost shrink-0 px-2", imageMode && "text-accent-soft")}
            onClick={() => setImageMode((v) => !v)}
            title="Image generation mode"
            aria-label="Toggle image generation"
            disabled={attachments.length > 0 || parsing}
          >
            <ImagePlus size={18} />
          </button>

          <textarea
            ref={textarea}
            aria-label={imageMode ? "Image prompt" : "Message"}
            value={text}
            onPaste={(e) => {
              // Pasted screenshots / copied images arrive as clipboard files.
              const files = Array.from(e.clipboardData?.files ?? []);
              if (files.length === 0) return;
              handleFiles(files);
              // Keep normal text paste working when the clipboard has both.
              if (!e.clipboardData.getData("text/plain")) e.preventDefault();
            }}
            onChange={(e) => {
              setText(e.target.value);
              updateSlash(e.target.value, e.target.selectionStart ?? e.target.value.length);
              autoGrow();
            }}
            onClick={(e) => {
              const el = e.currentTarget;
              updateSlash(el.value, el.selectionStart ?? el.value.length);
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              const menuOpen = slash && slashMatches.length > 0;
              if (menuOpen) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSlashIndex((i) => (i + 1) % slashMatches.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSlashIndex((i) => (i - 1 + slashMatches.length) % slashMatches.length);
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  applySnippet(slashMatches[slashIndex].body);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setSlash(null);
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={
              disabled
                ? "Add a provider and model to start chatting…"
                : imageMode
                  ? "Describe an image to generate…"
                  : "Send a message…  (Enter to send · Shift+Enter newline · / for snippets)"
            }
            rows={1}
            className="max-h-[260px] flex-1 resize-none bg-transparent py-2 text-[15px] text-ink outline-none placeholder:text-ink-faint"
          />

          <button
            className={clsx(
              "relative shrink-0 rounded-xl px-3 py-2.5",
              busy ? "btn-soft" : "btn-primary"
            )}
            onClick={busy ? onStop : submit}
            disabled={!busy && (disabled || parsing || (!text.trim() && attachments.length === 0))}
            title={busy ? "Stop" : "Send"}
            aria-label={busy ? "Stop generating" : "Send"}
          >
            {launchKey > 0 && (
              <span
                key={launchKey}
                aria-hidden
                className="pointer-events-none absolute inset-0 animate-send-ripple rounded-xl border-2 border-accent-soft"
              />
            )}
            {busy ? (
              <Square key="stop" size={16} className="animate-scale-in fill-current" />
            ) : (
              <ArrowUp key="send" size={18} className="animate-scale-in" />
            )}
          </button>
        </div>
      </div>
      <p className="mx-auto mt-2 hidden max-w-3xl text-center text-[11px] text-ink-faint sm:block">
        Enter to send · Shift+Enter for a new line · / for saved prompts
      </p>
    </div>
  );
}
