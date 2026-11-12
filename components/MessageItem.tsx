"use client";

import { useEffect, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { ReplyFileCreator } from "./ReplyFileCreator";
import { splitGeneratedFiles } from "@/lib/generated-files";
import { Markdown } from "./Markdown";
import { useStore } from "@/lib/store";
import { formatTokens } from "@/lib/tokens";
import { formatCost } from "@/lib/pricing";
import {
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  GitBranch,
  Trash2,
  AlertTriangle,
  FileText,
  ImageIcon,
  Brain,
  ChevronDown,
} from "lucide-react";
import clsx from "clsx";

export function MessageItem({
  message,
  convId,
  onRegenerate,
  onRetry,
  onBranch,
}: {
  message: ChatMessage;
  convId: string;
  onRegenerate?: () => void;
  onRetry?: () => void;
  onBranch?: (text: string) => void | Promise<void>;
}) {
  const title = useStore((state) => state.conversations.find((conversation) => conversation.id === convId)?.title);
  const removeMessage = useStore((s) => s.removeMessage);
  const [copied, setCopied] = useState(false);
  const [branchError, setBranchError] = useState("");
  const [branching, setBranching] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!message.retryAt || message.retryAt <= Date.now()) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [message.retryAt]);
  const retrySeconds = Math.max(0, Math.ceil(((message.retryAt ?? 0) - now) / 1000));
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
        {editing ? (
          <div className="w-full max-w-xl rounded-2xl border border-accent/30 bg-bg-panel p-4">
            <label className="mb-2 block text-sm font-medium" htmlFor={`branch-${message.id}`}>Edit prompt in a new branch</label>
            <p className="mb-3 text-xs text-ink-muted">Earlier messages and attachments carry over. The original chat stays intact.</p>
            <textarea id={`branch-${message.id}`} autoFocus className="input min-h-28 resize-y" value={draft} onChange={(e) => setDraft(e.target.value)} />
            {branchError && <p role="alert" className="mt-2 text-xs text-red-400">{branchError}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn-primary" disabled={branching || !onBranch || (!draft.trim() && !message.attachments?.length)} onClick={async () => {
                if (!onBranch || branching) return;
                setBranching(true);
                setBranchError("");
                try { await onBranch(draft); setEditing(false); }
                catch (error) { setBranchError(error instanceof Error ? error.message : "Could not create a branch. Try again."); }
                finally { setBranching(false); }
              }}><GitBranch size={14} /> Branch & send</button>
            </div>
          </div>
        ) : message.content && (
          <div className="max-w-[88%] overflow-hidden whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-overlay/[0.06] px-4 py-2.5 text-[15px] leading-relaxed text-ink sm:max-w-[80%]">
            {message.content}
          </div>
        )}
        <div className="msg-toolbar">
          {onBranch && <ToolbarButton label="Edit & branch" onClick={() => { setDraft(message.content); setBranchError(""); setEditing(true); }}><GitBranch size={14} /></ToolbarButton>}
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

        {message.reasoning && (
          <Thinking
            text={message.reasoning}
            live={!!message.streaming && !message.content}
          />
        )}

        {message.content && (
          <>
            <Markdown content={message.content} origin={{ conversationId: convId, messageId: message.id, title }} createdAt={message.createdAt} pending={message.streaming} fileRevision={message.fileRevision} />
            {message.streaming && <span className="stream-caret" aria-hidden />}
          </>
        )}
        {message.error && (
          <div role="alert" aria-label="Request error" className="mt-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-sm">
            <div className="flex items-start gap-2 text-ink">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" />
              <span>{message.error}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {onRetry && <button className="btn-soft text-xs" disabled={retrySeconds > 0} onClick={onRetry}><RotateCcw size={13} />{retrySeconds > 0 ? `Retry in ${retrySeconds}s` : "Retry"}</button>}
              {(message.errorCode === "authentication" || message.errorCode === "quota") && (
                <button className="btn-ghost text-xs" onClick={() => document.dispatchEvent(new CustomEvent("open-settings"))}>Providers & keys</button>
              )}
              {message.content && <span className="text-xs text-ink-muted">Partial reply kept. Retrying requests a new answer.</span>}
            </div>
          </div>
        )}
        {!message.content && !message.error && message.streaming && !message.reasoning && (
          <div className="thinking-dots flex items-center gap-1 py-2"><span /><span /><span /></div>
        )}

        {message.fileNotice && <p role="status" className="mt-2 text-xs text-ink-muted">{message.fileNotice}</p>}
        {!message.streaming && !message.error && message.content && !splitGeneratedFiles(message.content).some((part) => part.kind === "file") && <ReplyFileCreator content={message.content} origin={{ conversationId: convId, messageId: message.id, title }} createdAt={message.createdAt} />}
        {!message.streaming && (message.content || message.error) && (
          <div className="msg-toolbar mt-2 w-fit">
            {message.content && (
              <ToolbarButton label={copied ? "Copied" : "Copy"} onClick={copy}>
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              </ToolbarButton>
            )}
            {onRegenerate && !message.error && (
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

/** Collapsible reasoning ("thinking") from models that stream it. */
function Thinking({ text, live }: { text: string; live: boolean }) {
  const [open, setOpen] = useState<boolean | null>(null);
  // Open while the model is still thinking; collapse once the answer starts,
  // unless the user has toggled it themselves.
  const isOpen = open ?? live;
  return (
    <div className="mb-3 rounded-xl border border-line/70 bg-overlay/[0.025]">
      <button
        type="button"
        onClick={() => setOpen(!isOpen)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-ink-muted hover:text-ink"
        aria-expanded={isOpen}
      >
        <Brain size={14} className={clsx("text-accent-soft", live && "animate-pulse")} />
        <span className="font-medium">{live ? "Thinking…" : "Thought process"}</span>
        <ChevronDown
          size={14}
          className={clsx("ml-auto transition-transform", isOpen && "rotate-180")}
        />
      </button>
      {isOpen && (
        <div className="max-h-72 overflow-y-auto border-t border-line/60 px-3 py-2 text-[13px] leading-relaxed text-ink-muted">
          <div className="whitespace-pre-wrap break-words">{text}</div>
        </div>
      )}
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
