"use client";

import { useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import {
  DEFAULT_REGEX,
  RegexDraft,
  buildRegexScript,
  parseRegexScript,
  regexFilename,
  testRegex,
  PLACEMENT_LABELS,
  SUBSTITUTE,
  STARTER_REGEX,
} from "@/lib/sillytavern-regex";
import {
  X,
  Download,
  Upload,
  Copy,
  Check,
  Save,
  Trash2,
  Regex as RegexIcon,
  Library,
  RotateCcw,
  FlaskConical,
  AlertTriangle,
  Plus,
} from "lucide-react";
import clsx from "clsx";

const SAMPLE_DEFAULT =
  "<think>The user wants a warm greeting. Keep it short.</think>\nSeraphina looked up and smiled. “You're finally here.”";

export function RegexBuilder({ onClose }: { onClose: () => void }) {
  const regexScripts = useStore((s) => s.regexScripts);
  const saveRegex = useStore((s) => s.saveRegex);
  const removeRegex = useStore((s) => s.removeRegex);
  const addRegexScripts = useStore((s) => s.addRegexScripts);

  const [draft, setDraft] = useState<RegexDraft>({ ...DEFAULT_REGEX });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [sample, setSample] = useState(SAMPLE_DEFAULT);
  const fileInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof RegexDraft>(k: K, v: RegexDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const json = useMemo(() => JSON.stringify(buildRegexScript(draft), null, 2), [draft]);
  const result = useMemo(() => testRegex(draft, sample), [draft, sample]);

  const download = () => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = regexFilename(draft.scriptName);
    a.click();
    URL.revokeObjectURL(url);
  };
  const copy = () =>
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  const importFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      setDraft(parseRegexScript(parsed, file.name.replace(/\.json$/i, "")));
      setEditingId(null);
    } catch (e: any) {
      alert(`Could not import script: ${e.message || "invalid JSON"}`);
    }
  };
  const save = () => setEditingId(saveRegex(draft, editingId ?? undefined));
  const loadScript = (id: string) => {
    const r = regexScripts.find((x) => x.id === id);
    if (!r) return;
    const { id: _i, updatedAt: _u, ...rest } = r;
    setDraft(rest);
    setEditingId(id);
    setShowLibrary(false);
  };

  const togglePlacement = (value: number) => {
    setDraft((d) => ({
      ...d,
      placement: d.placement.includes(value)
        ? d.placement.filter((p) => p !== value)
        : [...d.placement, value],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 p-0 backdrop-blur-sm sm:p-6">
      <div className="card flex w-full max-w-5xl animate-scale-in flex-col overflow-hidden sm:rounded-2xl">
        <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
          <RegexIcon size={18} className="text-accent-soft" />
          <h2 className="text-base font-semibold">Regex Script Builder</h2>
          <span className="hidden text-xs text-ink-faint sm:inline">SillyTavern 1.18.0</span>
          <div className="ml-auto flex items-center gap-1.5">
            <button className="btn-ghost text-xs" onClick={() => setShowLibrary((v) => !v)}>
              <Library size={15} /> Library
              {regexScripts.length > 0 && (
                <span className="rounded-full bg-bg-elevated px-1.5 text-[10px]">{regexScripts.length}</span>
              )}
            </button>
            <button className="btn-ghost px-2" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Left: form */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto border-line p-4 lg:border-r">
            <Field label="Script name">
              <input value={draft.scriptName} onChange={(e) => set("scriptName", e.target.value)} className="input font-medium" />
            </Field>
            <Field label="Find regex" hint="Use /pattern/flags — e.g. /<think>[\\s\\S]*?<\\/think>/gi">
              <input value={draft.findRegex} onChange={(e) => set("findRegex", e.target.value)} className="input font-mono text-[13px]" placeholder="/pattern/flags" spellCheck={false} />
            </Field>
            <Field label="Replace with" hint="{{match}} = matched text · $1, $2 = capture groups · empty = delete">
              <textarea value={draft.replaceString} onChange={(e) => set("replaceString", e.target.value)} rows={2} className="input resize-y font-mono text-[13px]" placeholder="{{match}}" spellCheck={false} />
            </Field>
            <Field label="Trim strings" hint="Removed from each match before substitution — one per line">
              <textarea
                value={draft.trimStrings.join("\n")}
                onChange={(e) => set("trimStrings", e.target.value.split("\n"))}
                rows={2}
                className="input resize-y font-mono text-[12px]"
                spellCheck={false}
              />
            </Field>

            <Field label="Affects">
              <div className="grid grid-cols-2 gap-1.5">
                {PLACEMENT_LABELS.map((p) => (
                  <label key={p.value} className={clsx(
                    "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition",
                    draft.placement.includes(p.value) ? "border-accent/50 bg-bg-elevated text-ink" : "border-line bg-bg-subtle/60 text-ink-muted"
                  )} title={p.hint}>
                    <input type="checkbox" checked={draft.placement.includes(p.value)} onChange={() => togglePlacement(p.value)} className="accent-accent" />
                    {p.label}
                  </label>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Toggle label="Only affect display" value={draft.markdownOnly} onChange={(v) => set("markdownOnly", v)} hint="Alters what you see, not the prompt" />
              <Toggle label="Only affect prompt" value={draft.promptOnly} onChange={(v) => set("promptOnly", v)} hint="Alters what's sent, not display" />
              <Toggle label="Run on edit" value={draft.runOnEdit} onChange={(v) => set("runOnEdit", v)} />
              <Toggle label="Disabled" value={draft.disabled} onChange={(v) => set("disabled", v)} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Field label="Macros in find">
                <select value={draft.substituteRegex} onChange={(e) => set("substituteRegex", Number(e.target.value))} className="input">
                  <option value={SUBSTITUTE.NONE}>None</option>
                  <option value={SUBSTITUTE.RAW}>Raw</option>
                  <option value={SUBSTITUTE.ESCAPED}>Escaped</option>
                </select>
              </Field>
              <Field label="Min depth">
                <input type="number" value={draft.minDepth ?? ""} onChange={(e) => set("minDepth", e.target.value === "" ? null : Number(e.target.value))} className="input" placeholder="—" />
              </Field>
              <Field label="Max depth">
                <input type="number" value={draft.maxDepth ?? ""} onChange={(e) => set("maxDepth", e.target.value === "" ? null : Number(e.target.value))} className="input" placeholder="—" />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <button className="btn-primary text-sm" onClick={download}><Download size={15} /> Export .json</button>
              <button className="btn-soft text-sm" onClick={save}><Save size={15} /> {editingId ? "Update" : "Save"}</button>
              <button className="btn-soft text-sm" onClick={() => fileInput.current?.click()}><Upload size={15} /> Import</button>
              <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={(e) => { if (e.target.files?.[0]) importFile(e.target.files[0]); e.target.value = ""; }} />
              <div className="flex-1" />
              <button className="btn-ghost text-xs" onClick={() => { setDraft({ ...DEFAULT_REGEX }); setEditingId(null); }}><RotateCcw size={14} /> Reset</button>
            </div>
          </div>

          {/* Right: tester / library */}
          <div className="flex w-full min-h-0 flex-col lg:w-[44%]">
            {showLibrary ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <div className="mb-2 flex justify-end">
                  <button className="btn-ghost text-xs" onClick={() => addRegexScripts(STARTER_REGEX)}>
                    <Plus size={14} /> Add starter pack
                  </button>
                </div>
                {regexScripts.length === 0 ? (
                  <p className="py-8 text-center text-sm text-ink-faint">No saved scripts yet.</p>
                ) : (
                  <div className="space-y-2">
                    {regexScripts.map((r) => (
                      <div key={r.id} className={clsx("flex items-center gap-2 rounded-lg border p-3",
                        r.id === editingId ? "border-accent/50 bg-bg-elevated" : "border-line bg-bg-subtle/60")}>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-ink">{r.scriptName}</div>
                          <div className="truncate font-mono text-[10px] text-ink-faint">{r.findRegex || "(empty)"}</div>
                        </div>
                        <button className="btn-soft text-xs" onClick={() => loadScript(r.id)}>Load</button>
                        <button className="text-ink-faint hover:text-red-400" onClick={() => removeRegex(r.id)} aria-label="Delete"><Trash2 size={15} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                  <FlaskConical size={14} className="text-accent-soft" />
                  <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Live tester</span>
                  {result.ok && draft.findRegex.trim() && (
                    <span className="ml-auto text-[11px] text-ink-faint">
                      {result.matchCount} match{result.matchCount === 1 ? "" : "es"}
                    </span>
                  )}
                </div>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                  <div>
                    <label className="mb-1 block text-xs text-ink-muted">Sample input</label>
                    <textarea value={sample} onChange={(e) => setSample(e.target.value)} rows={5} className="input resize-y font-mono text-[12px]" spellCheck={false} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-ink-muted">Result</label>
                    {result.error ? (
                      <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {result.error}
                      </div>
                    ) : (
                      <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-[#0b0e16] p-3 font-mono text-[12px] text-ink">
                        {result.output || <span className="text-ink-faint">(empty — everything matched was removed)</span>}
                      </pre>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wide text-ink-faint">Script JSON</span>
                    <button className="btn-ghost text-xs" onClick={copy}>
                      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <pre className="max-h-40 overflow-auto rounded-lg bg-[#0b0e16] p-3 font-mono text-[11px] text-ink-muted">{json}</pre>
                </div>
              </div>
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

function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-line bg-bg-subtle/60 px-3 py-2 text-xs" title={hint}>
      <span className="text-ink-muted">{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="accent-accent" />
    </label>
  );
}
