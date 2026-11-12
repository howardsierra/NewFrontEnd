"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useSyncStatus } from "@/lib/sync/engine";
import { timeAgo } from "./SyncModal";
import {
  Plus,
  Sparkles,
  ChevronDown,
  Files,
  Search,
  MessageSquare,
  Trash2,
  Settings,
  Pencil,
  Check,
  X,
  Wand2,
  BookText,
  DatabaseBackup,
  Palette,
  Regex,
  Drama,
  Cloud,
  CloudOff,
  RefreshCw,
} from "lucide-react";
import clsx from "clsx";

export function Sidebar({
  onOpenFiles,
  onOpenSettings,
  onOpenPresets,
  onOpenSnippets,
  onOpenThemes,
  onOpenRegex,
  onOpenPersonas,
  onOpenBackup,
  onOpenSync,
  onClose,
}: {
  onOpenFiles: () => void;
  onOpenSettings: () => void;
  onOpenPresets: () => void;
  onOpenSnippets: () => void;
  onOpenThemes: () => void;
  onOpenRegex: () => void;
  onOpenPersonas: () => void;
  onOpenBackup: () => void;
  onOpenSync: () => void;
  onClose?: () => void;
}) {
  const conversations = useStore((s) => s.conversations);
  const activeId = useStore((s) => s.activeId);
  const setActive = useStore((s) => s.setActive);
  const newConversation = useStore((s) => s.newConversation);
  const removeConversation = useStore((s) => s.removeConversation);
  const renameConversation = useStore((s) => s.renameConversation);
  const providers = useStore((s) => s.providers);

  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(normalizedQuery) ||
    c.messages.some((m) => m.content.toLowerCase().includes(normalizedQuery))
  ).sort((a, b) => b.updatedAt - a.updatedAt);

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  return (
    <div className="flex h-full w-72 min-h-0 flex-col border-r border-line/60 bg-bg-subtle">
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <span className="grid h-10 w-10 place-items-center rounded-2xl border border-line bg-bg-panel text-accent-soft"><Sparkles size={20} strokeWidth={1.5} /></span>
        <div className="leading-tight">
          <div className="font-display text-lg font-semibold tracking-tight text-ink">Flux.AI</div>
          <div className="mt-1 text-xs text-ink-muted">Your personal studio</div>
        </div>
      </div>

      <div className="px-3">
        <button
          className="btn-primary w-full"
          onClick={() => {
            newConversation();
            onClose?.();
          }}
        >
          <Plus size={16} /> New chat
          <kbd className="ml-auto rounded border border-white/25 px-1.5 py-0.5 text-[10px] font-normal text-white/70">
            ⌘/Ctrl K
          </kbd>
        </button>
      </div>

      <div className="mx-3 mt-2">
        <button className="nav-item nav-item-featured" onClick={() => { onOpenFiles(); onClose?.(); }}><Files size={17} className="text-accent-soft" />File library</button>
      </div>
      <label className="relative mx-3 mt-3 block">
        <Search size={14} className="pointer-events-none absolute left-3 top-3 text-ink-faint" />
        <input aria-label="Search conversations" placeholder="Search chats & messages" value={query}
          onChange={(e) => setQuery(e.target.value)} className="input pl-9 pr-8 text-xs" />
        {query && <button aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-2 top-2 p-1 text-ink-muted"><X size={14} /></button>}
      </label>
      <div className="mt-4 flex items-center justify-between px-4 pb-1.5">
        <span className="text-xs font-medium text-ink-muted">
          {query ? "Search results" : "Recent chats"}
        </span>
        <span className="text-[11px] text-ink-faint">{filtered.length}</span>
      </div>

      <div className="min-h-20 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-ink-faint">
            No conversations yet.
          </p>
        )}
        {filtered.length === 0 && query && <p role="status" className="px-3 py-6 text-center text-xs text-ink-muted">No chats found. Try another search.</p>}
        {filtered.map((c) => {
          const isActive = c.id === activeId;
          return (
            <div
              key={c.id}
              className={clsx(
                "group relative flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-accent/10 text-ink"
                  : "text-ink-muted hover:bg-overlay/[0.05] hover:text-ink"
              )}
            >
              {isActive && (
                <span className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-accent" />
              )}
              {editing === c.id ? (
                <>
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        renameConversation(c.id, draft || "Untitled");
                        setEditing(null);
                      }
                      if (e.key === "Escape") setEditing(null);
                    }}
                    className="input py-1 text-sm"
                  />
                  <button
                    className="text-ink-muted hover:text-green-400"
                    onClick={() => {
                      renameConversation(c.id, draft || "Untitled");
                      setEditing(null);
                    }}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    className="text-ink-muted hover:text-red-400"
                    onClick={() => setEditing(null)}
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => {
                      setActive(c.id);
                      onClose?.();
                    }}
                  >
                    <MessageSquare size={15} className="shrink-0 opacity-70" />
                    <span className="truncate">{c.title}</span>
                  </button>
                  <button
                    className="opacity-100 transition sm:opacity-0 group-hover:opacity-100 focus:opacity-100 group-focus-within:opacity-100 hover:text-ink"
                    onClick={() => {
                      setEditing(c.id);
                      setDraft(c.title);
                    }}
                    aria-label="Rename"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className="opacity-100 transition sm:opacity-0 group-hover:opacity-100 focus:opacity-100 group-focus-within:opacity-100 hover:text-red-400"
                    onClick={() => {
                      if (!c.messages.length || window.confirm(`Delete “${c.title}”? This cannot be undone.`)) removeConversation(c.id);
                    }}
                    aria-label="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-line/60 px-3 pb-3 pt-2">
        <details className="studio-tools max-h-[40dvh] overflow-y-auto">
          <summary className="nav-item cursor-pointer"><Wand2 size={17} />Studio tools<ChevronDown size={14} className="studio-chevron ml-auto transition-transform" /></summary>
          <div className="mb-2 ml-2 space-y-0.5 border-l border-line pl-2">
            {[
              { label: "Prompt library", icon: BookText, action: onOpenSnippets },
              { label: "Personas", icon: Drama, action: onOpenPersonas },
              { label: "SillyTavern presets", icon: Wand2, action: onOpenPresets },
              { label: "ST themes", icon: Palette, action: onOpenThemes },
              { label: "ST regex scripts", icon: Regex, action: onOpenRegex },
            ].map((tool) => <button key={tool.label} className="nav-item" onClick={() => { tool.action(); onClose?.(); }}><tool.icon size={16} />{tool.label}</button>)}
          </div>
        </details>
        <button className="nav-item" onClick={() => { onOpenSettings(); onClose?.(); }}><Settings size={17} />Providers &amp; keys{providers.length === 0 && <span className="ml-auto rounded-md bg-accent/10 px-2 py-1 text-[10px] font-medium text-accent-soft">Set up</span>}</button>
        <div className="mt-3 flex items-center gap-1 border-t border-line/60 pt-1">
          <SyncCard onClick={() => { onOpenSync(); onClose?.(); }} />
          <button className="btn-ghost min-w-10 px-2" title="Backup & restore" aria-label="Backup & restore" onClick={() => { onOpenBackup(); onClose?.(); }}><DatabaseBackup size={17} /></button>
        </div>
      </div>
    </div>
  );
}

function SyncCard({ onClick }: { onClick: () => void }) {
  const status = useSyncStatus();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const off = status.phase === "off";
  const Icon = status.phase === "error" ? CloudOff : status.phase === "syncing" ? RefreshCw : Cloud;
  const subtitle = off
    ? "This device only · set up sync"
    : status.phase === "syncing"
      ? "Syncing…"
      : status.phase === "error"
        ? "Sync paused · tap for details"
        : `Synced ${timeAgo(status.lastSync)}`;

  return (
    <button
      onClick={onClick}
      className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-3 text-left transition hover:opacity-90"
    >
      <span
        className={clsx(
          "relative grid h-8 w-8 shrink-0 place-items-center rounded-lg",
          off ? "bg-overlay/[0.06] text-ink-muted" : "bg-accent/10 text-accent-soft"
        )}
      >
        <Icon size={15} className={clsx(status.phase === "syncing" && "animate-spin")} />
        {!off && (
          <span
            className={clsx(
              "absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-bg-subtle",
              status.phase === "error" ? "bg-red-400" : "bg-green-400"
            )}
          />
        )}
      </span>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-xs font-medium text-ink">
          {off ? "Local workspace" : "Synced workspace"}
        </div>
        <div className="truncate text-[11px] text-ink-muted">{subtitle}</div>
      </div>
    </button>
  );
}
