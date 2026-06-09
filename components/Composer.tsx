"use client";

import { useRef, useState } from "react";
import { parseFile } from "@/lib/files";
import type { Attachment } from "@/lib/types";
import {
  Paperclip,
  ArrowUp,
  Square,
  X,
  FileText,
  ImageIcon,
  Loader2,
} from "lucide-react";
import clsx from "clsx";

export function Composer({
  busy,
  disabled,
  onSend,
  onStop,
}: {
  busy: boolean;
  disabled: boolean;
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop: () => void;
}) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [parsing, setParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

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
          "mx-auto max-w-3xl rounded-2xl border bg-bg-panel/90 p-2 shadow-2xl backdrop-blur transition",
          dragOver ? "border-accent shadow-glow" : "border-line"
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

          <textarea
            ref={textarea}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              autoGrow();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={
              disabled
                ? "Add a provider and model to start chatting…"
                : "Send a message…  (Enter to send, Shift+Enter for newline)"
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
