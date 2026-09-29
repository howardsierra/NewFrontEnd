"use client";

import { useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { Markdown } from "./Markdown";
import { useStore } from "@/lib/store";
import { formatTokens } from "@/lib/tokens";
import { formatCost } from "@/lib/pricing";
import {
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Trash2,
  AlertTriangle,
  FileText,
  ImageIcon,
} from "lucide-react";
import clsx from "clsx";

export function MessageItem({
  message,
  convId,
  onRegenerate,
}: {
  message: ChatMessage;
  convId: string;
  onRegenerate?: () => void;
}) {
  const removeMessage = useStore((s) => s.removeMessage);
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const copy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const attachments = message.attachments?.length ? (
    <div className={clsx("flex flex-wrap gap-2", isUser && "justify-end")}>
      {message.attachments.map((a) => (
        <div key={a.id}>
          {a.kind === "image" && a.dataUrl ? (
            <img
              src={a.dataUrl}
              alt={a.name}
              className="max-h-64 rounded-xl border border-line"
            />
          ) : (
            <span className="chip">
              {a.kind === "image" ? <ImageIcon size={13} /> : <FileText size={13} />}
              {a.name}
            </span>
          )}
        </div>
      ))}
    </div>
  ) : null;

  // ---- User turn: right-aligned bubble ----
  if (isUser) {
    return (
      <div className="group flex animate-bubble-in flex-col items-end gap-1.5">
        {attachments}
        {message.content && (
          <div className="max-w-[88%] overflow-hidden whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-overlay/[0.06] px-4 py-2.5 text-[15px] leading-relaxed text-ink sm:max-w-[80%]">
            {message.content}
          </div>
        )}
        <div className="msg-toolbar">
          {message.content && (
            <ToolbarButton label={copied ? "Copied" : "Copy"} onClick={copy}>
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </ToolbarButton>
          )}
          <ToolbarButton label="Delete" danger onClick={() => removeMessage(convId, message.id)}>
            <Trash2 size={14} />
          </ToolbarButton>
        </div>
      </div>
    );
  }

  // ---- Assistant turn: left, avatar + name, full width ----
  return (
    <div className="group flex animate-fade-in gap-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-accent-grad text-white shadow-glow ring-1 ring-white/10">
        <Sparkles size={16} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
          <span className="font-display font-semibold text-ink-muted">
            {message.providerLabel || "Assistant"}
          </span>
          {message.model && <span className="font-mono text-[11px]">{message.model}</span>}
          {message.usage && (
            <span
              className="font-mono text-[11px] text-ink-faint"
              title={`Prompt ${message.usage.input} · Completion ${message.usage.output} tokens`}
            >
              ↑{formatTokens(message.usage.input)} ↓{formatTokens(message.usage.output)} tok
            </span>
          )}
          {typeof message.cost === "number" && (
            <span className="font-mono text-[11px] text-green-400/70" title="Estimated cost">
              {formatCost(message.cost)}
            </span>
          )}
        </div>

        {attachments && <div className="mb-2">{attachments}</div>}

        {message.error ? (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{message.error}</span>
          </div>
        ) : message.content ? (
          <>
            <Markdown content={message.content} />
            {message.streaming && <span className="stream-caret" aria-hidden />}
          </>
        ) : message.streaming ? (
          <div className="thinking-dots flex items-center gap-1 py-2">
            <span /> <span /> <span />
          </div>
        ) : null}

        {!message.streaming && (message.content || message.error) && (
          <div className="msg-toolbar mt-2 w-fit">
            {message.content && (
              <ToolbarButton label={copied ? "Copied" : "Copy"} onClick={copy}>
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              </ToolbarButton>
            )}
            {onRegenerate && (
              <ToolbarButton label="Regenerate" onClick={onRegenerate}>
                <RotateCcw size={14} />
              </ToolbarButton>
            )}
            <ToolbarButton label="Delete" danger onClick={() => removeMessage(convId, message.id)}>
              <Trash2 size={14} />
            </ToolbarButton>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={clsx(
        "grid h-8 w-8 place-items-center rounded-full text-ink-faint transition hover:bg-overlay/[0.08] hover:text-ink active:scale-90",
        danger && "hover:text-red-400"
      )}
    >
      {children}
    </button>
  );
}
