"use client";

import { useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { STARTER_SNIPPETS } from "@/lib/snippets";
import {
  X,
  Plus,
  Search,
  Trash2,
  Pencil,
  Copy,
  Check,
  CornerDownLeft,
  TextCursorInput,
  Download,
  Upload,
  Sparkles,
  BookText,
} from "lucide-react";
import clsx from "clsx";

/** Fire-and-forget insert into the active composer (Composer listens for this). */
export function insertSnippet(body: string) {
  document.dispatchEvent(new CustomEvent("insert-snippet", { detail: body }));
}

export function SnippetLibrary({ onClose }: { onClose: () => void }) {
  const snippets = useStore((s) => s.snippets);
  const saveSnippet = useStore((s) => s.saveSnippet);
  const removeSnippet = useStore((s) => s.removeSnippet);
  const addSnippets = useStore((s) => s.addSnippets);
  const conversations = useStore((s) => s.conversations);
  const activeId = useStore((s) => s.activeId);
  const updateParams = useStore((s) => s.updateParams);

  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return snippets;
    return snippets.filter(
      (s) =>
        s.title.toLowerCase().includes(q) || s.body.toLowerCase().includes(q)
    );
  }, [snippets, query]);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setBody("");
  };

  const startEdit = (id: string) => {
    const s = snippets.find((x) => x.id === id);
    if (!s) return;
    setEditingId(id);
    setTitle(s.title);
    setBody(s.body);
  };

  const submit = () => {
    if (!title.trim() && !body.trim()) return;
    saveSnippet({ title: title.trim() || "Untitled", body }, editingId ?? undefined);
    resetForm();
  };

  const insert = (b: string) => {
    insertSnippet(b);
    onClose();
  };

  const asSystemPrompt = (b: string) => {
    if (!activeId) return;
    updateParams(activeId, { systemPrompt: b });
    onClose();
  };

  const copy = (id: string, b: string) => {
    navigator.clipboard.writeText(b).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1200);
    });
  };

  const exportAll = () => {
    const data = snippets.map(({ title, body }) => ({ title, body }));
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "snippets.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = async (file: File) => {
    try {
      const json = JSON.parse(await file.text());
      const items = (Array.isArray(json) ? json : [])
        .filter((x) => x && typeof x.body === "string")
        .map((x) => ({ title: String(x.title || "Untitled"), body: String(x.body) }));
      if (!items.length) throw new Error("No valid snippets found.");
      addSnippets(items);
    } catch (e: any) {
      alert(`Could not import: ${e.message || "invalid JSON"}`);
    }
  };

  const hasActiveChat = !!activeId && conversations.some((c) => c.id === activeId);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 p-0 backdrop-blur-sm sm:p-6">
      <div className="card flex w-full max-w-5xl animate-fade-in flex-col overflow-hidden shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
          <BookText size={18} className="text-accent-soft" />
          <h2 className="text-base font-semibold">Prompt & Snippet Library</h2>
          <span className="hidden text-xs text-ink-faint sm:inline">
            Type <kbd className="rounded bg-bg-elevated px-1">/</kbd> in the
            composer to insert quickly
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <button className="btn-ghost text-xs" onClick={exportAll} disabled={!snippets.length}>
              <Download size={14} /> Export
            </button>
            <button className="btn-ghost text-xs" onClick={() => fileInput.current?.click()}>
              <Upload size={14} /> Import
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                if (e.target.files?.[0]) importFile(e.target.files[0]);
                e.target.value = "";
              }}
            />
            <button className="btn-ghost px-2" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* List */}
          <div className="flex min-h-0 flex-1 flex-col border-line lg:border-r">
            <div className="border-b border-line p-3">
              <div className="relative">
                <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search snippets…"
                  className="input pl-8"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {snippets.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <Sparkles size={24} className="text-accent-soft" />
                  <p className="text-sm text-ink-muted">
                    Your library is empty.
                  </p>
                  <button
                    className="btn-soft text-sm"
                    onClick={() => addSnippets(STARTER_SNIPPETS)}
                  >
                    <Plus size={15} /> Load starter pack
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-faint">
                  No matches for “{query}”.
                </p>
              ) : (
                <div className="space-y-2">
                  {filtered.map((s) => (
                    <div
                      key={s.id}
                      className={clsx(
                        "group rounded-lg border p-3 transition",
                        s.id === editingId
                          ? "border-accent/50 bg-bg-elevated"
                          : "border-line bg-bg-subtle/60 hover:border-line"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-ink">
                            {s.title}
                          </div>
                          <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs text-ink-muted">
                            {s.body}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        <button className="btn-primary px-2 py-1 text-xs" onClick={() => insert(s.body)}>
                          <CornerDownLeft size={13} /> Insert
                        </button>
                        <button
                          className="btn-ghost px-2 py-1 text-xs"
                          onClick={() => asSystemPrompt(s.body)}
                          disabled={!hasActiveChat}
                          title="Set as the active chat's system prompt"
                        >
                          <TextCursorInput size={13} /> As system
                        </button>
                        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => copy(s.id, s.body)}>
                          {copiedId === s.id ? (
                            <Check size={13} className="text-green-400" />
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>
                        <div className="flex-1" />
                        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => startEdit(s.id)}>
                          <Pencil size={13} />
                        </button>
                        <button
                          className="btn-ghost px-2 py-1 text-xs hover:text-red-400"
                          onClick={() => {
                            if (editingId === s.id) resetForm();
                            removeSnippet(s.id);
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Editor */}
          <div className="flex w-full flex-col p-4 lg:w-[40%]">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                {editingId ? "Edit snippet" : "New snippet"}
              </span>
              {editingId && (
                <button className="btn-ghost px-2 py-0.5 text-xs" onClick={resetForm}>
                  Cancel
                </button>
              )}
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="input mb-2 font-medium"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Snippet text. Use {{placeholders}} for fill-ins."
              className="input mb-3 flex-1 resize-none font-mono text-[13px] leading-relaxed"
              rows={10}
            />
            <button className="btn-primary" onClick={submit}>
              <Plus size={15} /> {editingId ? "Save changes" : "Add to library"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
