"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import {
  Plus,
  MessageSquare,
  Trash2,
  Settings,
  Sparkles,
  Pencil,
  Check,
  X,
  Wand2,
  BookText,
  DatabaseBackup,
  Palette,
  Regex,
} from "lucide-react";
import clsx from "clsx";

export function Sidebar({
  onOpenSettings,
  onOpenPresets,
  onOpenSnippets,
  onOpenThemes,
  onOpenRegex,
  onOpenBackup,
  onClose,
}: {
  onOpenSettings: () => void;
  onOpenPresets: () => void;
  onOpenSnippets: () => void;
  onOpenThemes: () => void;
  onOpenRegex: () => void;
  onOpenBackup: () => void;
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
    <div className="flex h-full w-72 flex-col border-r border-line/70 bg-bg-subtle/60 backdrop-blur-xl">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent-grad shadow-glow ring-1 ring-white/10">
          <Sparkles size={18} className="text-white" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight text-gradient">
            NewFrontEnd
          </div>
          <div className="text-[11px] text-ink-faint">AI Studio</div>
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
        </button>
      </div>

      <div className="mt-3 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
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
                  ? "bg-gradient-to-r from-accent/15 via-accent/[0.06] to-transparent text-ink"
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

      <div className="space-y-0.5 border-t border-line p-3">
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
    </div>
  );
}
