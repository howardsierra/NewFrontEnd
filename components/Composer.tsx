"use client";

import { useEffect, useRef, useState } from "react";
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
  busy,
  disabled,
  onSend,
  onStop,
  onGenerateImage,
}: {
  busy: boolean;
  disabled: boolean;
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop: () => void;
  onGenerateImage: (prompt: string, size: string) => void;
}) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [parsing, setParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [slash, setSlash] = useState<SlashState | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [pendingFill, setPendingFill] = useState<PendingFill | null>(null);
  const [imageMode, setImageMode] = useState(false);
  const [imageSize, setImageSize] = useState("1024x1024");
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
    setParsing(true);
    const added: Attachment[] = [];
    for (const file of Array.from(files)) {
      try {
        added.push(await parseFile(file));
      } catch (e: any) {
        alert(e.message || `Could not read ${file.name}`);
      }
    }
    setAttachments((prev) => [...prev, ...added]);
    setParsing(false);
  };

  const submit = () => {
    if (busy || parsing) return;
    if (imageMode) {
      if (!text.trim()) return;
      onGenerateImage(text.trim(), imageSize);
      setText("");
      if (textarea.current) textarea.current.style.height = "auto";
      return;
    }
    if (!text.trim() && attachments.length === 0) return;
    onSend(text.trim(), attachments);
    setText("");
    setAttachments([]);
    if (textarea.current) textarea.current.style.height = "auto";
  };

  const autoGrow = () => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 260) + "px";
  };

  return (
    <div className="px-3 pb-4 pt-1 sm:px-6">
      <div
        className={clsx(
          "glass relative mx-auto max-w-3xl rounded-[26px] p-2.5 shadow-[0_22px_60px_-26px_rgba(0,0,0,0.6)] ring-1 ring-overlay/[0.04] transition-all duration-200 focus-within:ring-accent/30 focus-within:shadow-glow",
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
                <div className="leading-tight">
                  <div className="max-w-[140px] truncate text-ink">{a.name}</div>
                  <div className="text-[10px] text-ink-faint">
                    {a.kind === "text"
                      ? `${a.text?.length ?? 0} chars`
                      : `${(a.size / 1024).toFixed(0)} KB`}
                  </div>
                </div>
                <button
                  className="ml-1 text-ink-faint hover:text-red-400"
                  onClick={() =>
                    setAttachments((prev) => prev.filter((x) => x.id !== a.id))
                  }
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
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

        <div className="flex items-end gap-2">
          <button
            className="btn-ghost shrink-0 px-2"
            onClick={() => fileInput.current?.click()}
            title="Attach files (html, css, js, json, pdf, images…)"
            aria-label="Attach files"
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
          >
            <ImagePlus size={18} />
          </button>

          <textarea
            ref={textarea}
            value={text}
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

          {busy ? (
            <button className="btn-soft shrink-0" onClick={onStop} title="Stop">
              <Square size={16} className="fill-current" />
            </button>
          ) : (
            <button
              className="btn-primary shrink-0 rounded-xl px-3 py-2.5"
              onClick={submit}
              disabled={disabled || parsing || (!text.trim() && attachments.length === 0)}
              title="Send"
            >
              <ArrowUp size={18} />
            </button>
          )}
        </div>
      </div>
      <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-ink-faint">
        Keys stay in your browser. Attach HTML, CSS, JS, JSON, PDFs, images, and code.
      </p>
    </div>
  );
}
