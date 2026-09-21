"use client";

import { useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import {
  DEFAULT_PERSONA,
  PersonaDraft,
  composePersona,
  personaFilename,
  STARTER_PERSONAS,
} from "@/lib/personas";
import {
  X,
  Download,
  Upload,
  Copy,
  Check,
  Save,
  Trash2,
  Drama,
  Library,
  RotateCcw,
  Sparkles,
  Plus,
} from "lucide-react";
import clsx from "clsx";

export function PersonaBuilder({ onClose }: { onClose: () => void }) {
  const personas = useStore((s) => s.personas);
  const savePersona = useStore((s) => s.savePersona);
  const removePersona = useStore((s) => s.removePersona);
  const addPersonas = useStore((s) => s.addPersonas);
  const conversations = useStore((s) => s.conversations);
  const activeId = useStore((s) => s.activeId);
  const setConversationPersona = useStore((s) => s.setConversationPersona);

  const [draft, setDraft] = useState<PersonaDraft>({ ...DEFAULT_PERSONA });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof PersonaDraft>(k: K, v: PersonaDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const composed = useMemo(() => composePersona(draft), [draft]);
  const activeConv = conversations.find((c) => c.id === activeId);

  const save = () => setEditingId(savePersona(draft, editingId ?? undefined));

  const applyToChat = () => {
    if (!activeConv) return;
    const id = savePersona(draft, editingId ?? undefined);
    setEditingId(id);
    setConversationPersona(activeConv.id, id);
    onClose();
  };

  const load = (id: string) => {
    const p = personas.find((x) => x.id === id);
    if (!p) return;
    const { id: _i, updatedAt: _u, ...rest } = p;
    setDraft(rest);
    setEditingId(id);
    setShowLibrary(false);
  };

  const download = () => {
    const blob = new Blob([JSON.stringify({ ...draft }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = personaFilename(draft.name);
    a.click();
    URL.revokeObjectURL(url);
  };
  const copy = () =>
    navigator.clipboard.writeText(composed).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  const importFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      setDraft({ ...DEFAULT_PERSONA, ...parsed, name: parsed.name || file.name.replace(/\.json$/i, "") });
      setEditingId(null);
    } catch (e: any) {
      alert(`Could not import persona: ${e.message || "invalid JSON"}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 p-0 backdrop-blur-sm sm:p-6">
      <div className="card flex w-full max-w-5xl animate-scale-in flex-col overflow-hidden sm:rounded-2xl">
        <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
          <Drama size={18} className="text-accent-soft" />
          <h2 className="text-base font-semibold">Personas</h2>
          <span className="hidden text-xs text-ink-faint sm:inline">
            Advanced prompts — give the AI a voice & personality
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <button className="btn-ghost text-xs" onClick={() => setShowLibrary((v) => !v)}>
              <Library size={15} /> Library
              {personas.length > 0 && (
                <span className="rounded-full bg-bg-elevated px-1.5 text-[10px]">{personas.length}</span>
              )}
            </button>
            <button className="btn-ghost px-2" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Left: guided fields */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto border-line p-4 lg:border-r">
            <div className="flex items-center gap-2">
              <input
                value={draft.emoji}
                onChange={(e) => set("emoji", e.target.value.slice(0, 4))}
                className="input w-14 text-center text-lg"
                aria-label="Emoji"
              />
              <input
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Persona name"
                className="input font-medium"
              />
            </div>

            <Field label="Identity" hint="Who they are / their role">
              <textarea value={draft.identity} onChange={(e) => set("identity", e.target.value)} rows={2}
                placeholder="a seasoned travel writer who has been everywhere twice" className="input resize-y text-sm" />
            </Field>
            <Field label="Personality" hint="Traits & temperament">
              <textarea value={draft.personality} onChange={(e) => set("personality", e.target.value)} rows={2}
                placeholder="Warm, curious, a little mischievous. Loves a good tangent." className="input resize-y text-sm" />
            </Field>
            <Field label="Voice & style" hint="How they speak">
              <textarea value={draft.voice} onChange={(e) => set("voice", e.target.value)} rows={2}
                placeholder="Vivid and sensory. Short punchy sentences mixed with the occasional long, winding one." className="input resize-y text-sm" />
            </Field>
            <Field label="Formatting" hint="How replies should look">
              <textarea value={draft.formatting} onChange={(e) => set("formatting", e.target.value)} rows={2}
                placeholder="Lead with a hook. Use short paragraphs. Bold the key takeaway." className="input resize-y text-sm" />
            </Field>
            <Field label="Rules" hint="Constraints, dos & don'ts">
              <textarea value={draft.rules} onChange={(e) => set("rules", e.target.value)} rows={2}
                placeholder="Never use corporate jargon. Don't hedge. Admit when you don't know." className="input resize-y text-sm" />
            </Field>
            <Field label="Examples" hint="Sample lines in their voice (optional)">
              <textarea value={draft.examples} onChange={(e) => set("examples", e.target.value)} rows={3}
                placeholder={"“Trust me — skip the guidebook. The best pho in Hanoi has no sign and no menu.”"} className="input resize-y font-mono text-[13px]" />
            </Field>

            <div className="rounded-lg border border-line bg-bg-subtle/60 p-3">
              <label className="flex cursor-pointer items-center justify-between gap-2 text-sm">
                <span className="text-ink-muted">Override temperature</span>
                <input type="checkbox" checked={draft.temperature !== null}
                  onChange={(e) => set("temperature", e.target.checked ? 0.8 : null)} className="accent-accent" />
              </label>
              {draft.temperature !== null && (
                <div className="mt-2">
                  <div className="mb-1 flex justify-between text-xs text-ink-muted">
                    <span>Temperature</span>
                    <span className="font-mono text-ink">{draft.temperature.toFixed(2)}</span>
                  </div>
                  <input type="range" min={0} max={2} step={0.05} value={draft.temperature}
                    onChange={(e) => set("temperature", Number(e.target.value))} className="w-full accent-accent" />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <button className="btn-primary text-sm" onClick={applyToChat} disabled={!activeConv}>
                <Sparkles size={15} /> Save & apply to chat
              </button>
              <button className="btn-soft text-sm" onClick={save}>
                <Save size={15} /> {editingId ? "Update" : "Save"}
              </button>
              <button className="btn-soft text-sm" onClick={() => fileInput.current?.click()}>
                <Upload size={15} /> Import
              </button>
              <button className="btn-soft text-sm" onClick={download}>
                <Download size={15} /> Export
              </button>
              <input ref={fileInput} type="file" accept=".json,application/json" hidden
                onChange={(e) => { if (e.target.files?.[0]) importFile(e.target.files[0]); e.target.value = ""; }} />
              <div className="flex-1" />
              <button className="btn-ghost text-xs" onClick={() => { setDraft({ ...DEFAULT_PERSONA }); setEditingId(null); }}>
                <RotateCcw size={14} /> Reset
              </button>
            </div>
          </div>

          {/* Right: composed prompt / library */}
          <div className="flex w-full min-h-0 flex-col lg:w-[42%]">
            {showLibrary ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <div className="mb-2 flex justify-end">
                  <button className="btn-ghost text-xs" onClick={() => addPersonas(STARTER_PERSONAS)}>
                    <Plus size={14} /> Add starter pack
                  </button>
                </div>
                {personas.length === 0 ? (
                  <p className="py-8 text-center text-sm text-ink-faint">No saved personas yet.</p>
                ) : (
                  <div className="space-y-2">
                    {personas.map((p) => (
                      <div key={p.id} className={clsx("flex items-center gap-2 rounded-lg border p-3",
                        p.id === editingId ? "border-accent/50 bg-bg-elevated" : "border-line bg-bg-subtle/60")}>
                        <span className="text-lg">{p.emoji}</span>
                        <div className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{p.name}</div>
                        <button className="btn-soft text-xs" onClick={() => load(p.id)}>Edit</button>
                        <button className="text-ink-faint hover:text-red-400" onClick={() => removePersona(p.id)} aria-label="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                    Composed system prompt
                  </span>
                  <button className="btn-ghost ml-auto text-xs" onClick={copy} disabled={!composed}>
                    {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  {composed ? (
                    <pre className="whitespace-pre-wrap rounded-lg border border-line bg-overlay/[0.02] p-3 font-mono text-[12px] leading-relaxed text-ink-muted">
                      {composed}
                    </pre>
                  ) : (
                    <p className="py-8 text-center text-sm text-ink-faint">
                      Fill in the fields on the left and the system prompt builds here.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label className="text-sm font-medium text-ink">{label}</label>
        {hint && <span className="truncate text-[11px] text-ink-faint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
