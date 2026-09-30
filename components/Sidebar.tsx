"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useSyncStatus } from "@/lib/sync/engine";
import { timeAgo } from "./SyncModal";
import {
  Plus,
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

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  return (
    <div className="flex h-full w-72 flex-col border-r border-line/70 bg-gradient-to-b from-bg-elevated/30 to-bg-subtle/60 backdrop-blur-xl">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <span className="relative grid h-8 w-8 place-items-center">
          <span className="absolute inset-0 -z-10 rounded-full bg-accent/45 blur-md" />
          <i className="absolute h-[22px] w-[7px] rounded-full bg-accent" />
          <i className="absolute h-[22px] w-[7px] rounded-full bg-accent-glow" style={{ transform: "rotate(60deg)" }} />
          <i className="absolute h-[22px] w-[7px] rounded-full bg-accent-soft" style={{ transform: "rotate(-60deg)" }} />
        </span>
        <div className="leading-tight">
          <div className="font-display text-base font-bold tracking-tight text-gradient">
            Flux.AI
          </div>
          <div className="text-[11px] text-ink-faint">AI workspace</div>
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
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between px-4 pb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
          Recent
        </span>
      </div>

      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-ink-faint">
            No conversations yet.
          </p>
        )}
        {conversations.map((c) => {
          const isActive = c.id === activeId;
          return (
            <div
              key={c.id}
              className={clsx(
                "group relative flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                isActive
                  ? "bg-gradient-to-r from-accent/20 via-accent/[0.07] to-transparent text-ink ring-1 ring-inset ring-accent/15"
                  : "text-ink-muted hover:bg-overlay/[0.05] hover:text-ink"
              )}
            >
              {isActive && (
                <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent-grad" />
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
                    className="opacity-0 transition group-hover:opacity-100 hover:text-ink"
                    onClick={() => {
                      setEditing(c.id);
                      setDraft(c.title);
                    }}
                    aria-label="Rename"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className="opacity-0 transition group-hover:opacity-100 hover:text-red-400"
                    onClick={() => removeConversation(c.id)}
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

      <div className="border-t border-line p-3">
        <span className="mb-1 block px-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
          Studio
        </span>
        <div className="space-y-0.5">
          <button
            className="btn-ghost w-full justify-start"
            onClick={() => {
              onOpenSnippets();
              onClose?.();
            }}
          >
            <BookText size={16} />
            Prompt library
          </button>
          <button
            className="btn-ghost w-full justify-start"
            onClick={() => {
              onOpenPersonas();
              onClose?.();
            }}
          >
            <Drama size={16} />
            Personas
          </button>
          <button
            className="btn-ghost w-full justify-start"
            onClick={() => {
              onOpenPresets();
              onClose?.();
            }}
          >
            <Wand2 size={16} />
            SillyTavern presets
          </button>
          <button
            className="btn-ghost w-full justify-start"
            onClick={() => {
              onOpenThemes();
              onClose?.();
            }}
          >
            <Palette size={16} />
            ST themes
          </button>
          <button
            className="btn-ghost w-full justify-start"
            onClick={() => {
              onOpenRegex();
              onClose?.();
            }}
          >
            <Regex size={16} />
            ST regex scripts
          </button>
          <button className="btn-ghost w-full justify-start" onClick={onOpenSettings}>
            <Settings size={16} />
            Providers & keys
            {providers.length === 0 && (
              <span className="ml-auto rounded-full bg-accent/20 px-2 py-0.5 text-[10px] text-accent-soft">
                setup
              </span>
            )}
          </button>
          <button
            className="btn-ghost w-full justify-start"
            onClick={() => {
              onOpenBackup();
              onClose?.();
            }}
          >
            <DatabaseBackup size={16} />
            Backup & restore
          </button>
        </div>

        <SyncCard
          onClick={() => {
            onOpenSync();
            onClose?.();
          }}
        />
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
      className="mt-2 flex w-full items-center gap-2.5 rounded-lg border-t border-line px-1 pt-3 text-left transition hover:opacity-90"
    >
      <span
        className={clsx(
          "relative grid h-8 w-8 shrink-0 place-items-center rounded-lg ring-1 ring-white/10",
          off ? "bg-overlay/[0.06] text-ink-muted" : "bg-accent-grad text-white"
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
        <div className="truncate text-[10px] text-ink-faint">{subtitle}</div>
      </div>
    </button>
  );
}
