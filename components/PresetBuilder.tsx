"use client";

import { downloadFile } from "@/lib/download";

import { useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import {
  DEFAULT_DRAFT,
  PresetDraft,
  buildPreset,
  parsePreset,
  presetFilename,
} from "@/lib/sillytavern";
import { useChat } from "@/lib/useChat";
import {
  X,
  Download,
  Upload,
  Copy,
  Check,
  Save,
  Trash2,
  Wand2,
  FileJson,
  FolderOpen,
  Library,
  RotateCcw,
} from "lucide-react";
import clsx from "clsx";

export function PresetBuilder({ onClose }: { onClose: () => void }) {
  const presets = useStore((s) => s.presets);
  const savePreset = useStore((s) => s.savePreset);
  const removePreset = useStore((s) => s.removePreset);
  const providers = useStore((s) => s.providers);
  const conversations = useStore((s) => s.conversations);
  const activeId = useStore((s) => s.activeId);
  const { send } = useChat();

  const [draft, setDraft] = useState<PresetDraft>({ ...DEFAULT_DRAFT });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [tab, setTab] = useState<"prompts" | "samplers" | "advanced">("prompts");
  const fileInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof PresetDraft>(key: K, value: PresetDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const presetJson = useMemo(
    () => JSON.stringify(buildPreset(draft), null, 2),
    [draft]
  );

  const download = () => {
    downloadFile(presetJson, presetFilename(draft.name), "application/json");
  };

  const copy = () => {
    navigator.clipboard.writeText(presetJson).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const importFile = async (file: File) => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const name = file.name.replace(/\.json$/i, "");
      setDraft(parsePreset(json, name));
      setEditingId(null);
    } catch (e: any) {
      alert(`Could not import preset: ${e.message || "invalid JSON"}`);
    }
  };

  const save = () => {
    const id = savePreset(draft, editingId ?? undefined);
    setEditingId(id);
  };

  const loadPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    const { id: _id, updatedAt: _u, ...rest } = p;
    setDraft(rest);
    setEditingId(id);
    setShowLibrary(false);
  };

  const pullFromChat = () => {
    const conv = conversations.find((c) => c.id === activeId);
    if (!conv) return;
    setDraft((d) => ({
      ...d,
      temperature: conv.params.temperature,
      topP: conv.params.topP,
      maxTokens: conv.params.maxTokens,
      mainPrompt: conv.params.systemPrompt || d.mainPrompt,
      model: conv.model || d.model,
    }));
  };

  const draftWithAI = () => {
    const conv = conversations.find((c) => c.id === activeId);
    const provider = providers.find((p) => p.id === conv?.providerId);
    if (!conv || !provider || !provider.apiKey || !conv.model) {
      alert(
        "Set up a provider and model in the chat first — 'Draft with AI' uses your active chat."
      );
      return;
    }
    const prompt = buildAIDraftPrompt(draft);
    send(prompt, []);
    onClose();
  };

  const tabs = [
    { id: "prompts" as const, label: "Prompts" },
    { id: "samplers" as const, label: "Samplers" },
    { id: "advanced" as const, label: "Advanced" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 p-0 backdrop-blur-sm sm:p-6">
      <div className="card flex w-full max-w-6xl animate-fade-in flex-col overflow-hidden shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
          <Wand2 size={18} className="text-accent-soft" />
          <h2 className="text-base font-semibold">SillyTavern Preset Builder</h2>
          <span className="hidden text-xs text-ink-faint sm:inline">
            Chat Completion preset · SillyTavern 1.18.0
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              className="btn-ghost text-xs"
              onClick={() => setShowLibrary((v) => !v)}
            >
              <Library size={15} /> Library
              {presets.length > 0 && (
                <span className="rounded-full bg-bg-elevated px-1.5 text-[10px]">
                  {presets.length}
                </span>
              )}
            </button>
            <button className="btn-ghost px-2" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Left: form */}
          <div className="flex min-h-0 flex-1 flex-col border-line lg:border-r">
            {/* Name + tabs */}
            <div className="space-y-3 border-b border-line p-4">
              <div className="flex items-center gap-2">
                <FileJson size={16} className="shrink-0 text-ink-faint" />
                <input
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Preset name"
                  className="input font-medium"
                />
              </div>
              <div className="flex gap-1 rounded-lg bg-bg-subtle p-1">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={clsx(
                      "flex-1 rounded-md px-3 py-1.5 text-sm transition",
                      tab === t.id
                        ? "bg-bg-elevated text-ink shadow"
                        : "text-ink-muted hover:text-ink"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
              {tab === "prompts" && <PromptsTab draft={draft} set={set} />}
              {tab === "samplers" && <SamplersTab draft={draft} set={set} />}
              {tab === "advanced" && <AdvancedTab draft={draft} set={set} />}
            </div>

            {/* Action bar */}
            <div className="flex flex-wrap items-center gap-2 border-t border-line p-3">
              <button className="btn-primary text-sm" onClick={download}>
                <Download size={15} /> Export .json
              </button>
              <button className="btn-soft text-sm" onClick={save}>
                <Save size={15} /> {editingId ? "Update" : "Save"}
              </button>
              <button
                className="btn-soft text-sm"
                onClick={() => fileInput.current?.click()}
              >
                <Upload size={15} /> Import
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
              <div className="flex-1" />
              <button
                className="btn-ghost text-xs"
                onClick={pullFromChat}
                title="Copy temperature, system prompt, and model from your active chat"
              >
                <FolderOpen size={14} /> From chat
              </button>
              <button
                className="btn-ghost text-xs"
                onClick={() => {
                  setDraft({ ...DEFAULT_DRAFT });
                  setEditingId(null);
                }}
              >
                <RotateCcw size={14} /> Reset
              </button>
            </div>
          </div>

          {/* Right: preview / library */}
          <div className="flex w-full min-h-0 flex-col lg:w-[42%]">
            {showLibrary ? (
              <LibraryPane
                presets={presets}
                onLoad={loadPreset}
                onDelete={removePreset}
                editingId={editingId}
              />
            ) : (
              <>
                <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                    Live preset JSON
                  </span>
                  <div className="ml-auto flex gap-1.5">
                    <button className="btn-ghost text-xs" onClick={draftWithAI}>
                      <Wand2 size={14} /> Draft with AI
                    </button>
                    <button className="btn-ghost text-xs" onClick={copy}>
                      {copied ? (
                        <Check size={14} className="text-green-400" />
                      ) : (
                        <Copy size={14} />
                      )}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
                <pre className="min-h-0 flex-1 overflow-auto bg-[#0d1117] p-4 font-mono text-[12px] leading-relaxed text-ink-muted">
                  {presetJson}
                </pre>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Tabs ----------------------------- */

type SetFn = <K extends keyof PresetDraft>(k: K, v: PresetDraft[K]) => void;

function PromptsTab({ draft, set }: { draft: PresetDraft; set: SetFn }) {
  return (
    <>
      <PromptField
        label="Main Prompt"
        hint="Core system instruction (identifier: main)."
        value={draft.mainPrompt}
        onChange={(v) => set("mainPrompt", v)}
        rows={6}
      />
      <PromptField
        label="Auxiliary Prompt"
        hint="Secondary system prompt, e.g. style/content guidance (identifier: nsfw)."
        value={draft.auxiliaryPrompt}
        onChange={(v) => set("auxiliaryPrompt", v)}
        rows={4}
      />
      <PromptField
        label="Post-History Instructions"
        hint="Injected after chat history — the 'jailbreak' slot (identifier: jailbreak)."
        value={draft.postHistoryPrompt}
        onChange={(v) => set("postHistoryPrompt", v)}
        rows={4}
      />
      <PromptField
        label="Enhance Definitions"
        hint="Optional. Disabled in prompt order by default."
        value={draft.enhanceDefinitions}
        onChange={(v) => set("enhanceDefinitions", v)}
        rows={3}
      />
    </>
  );
}

function SamplersTab({ draft, set }: { draft: PresetDraft; set: SetFn }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Slider label="Temperature" value={draft.temperature} min={0} max={2} step={0.01} onChange={(v) => set("temperature", v)} />
      <Slider label="Top P" value={draft.topP} min={0} max={1} step={0.01} onChange={(v) => set("topP", v)} />
      <Slider label="Top K" value={draft.topK} min={0} max={200} step={1} onChange={(v) => set("topK", v)} />
      <Slider label="Top A" value={draft.topA} min={0} max={1} step={0.01} onChange={(v) => set("topA", v)} />
      <Slider label="Min P" value={draft.minP} min={0} max={1} step={0.01} onChange={(v) => set("minP", v)} />
      <Slider label="Frequency Penalty" value={draft.frequencyPenalty} min={-2} max={2} step={0.01} onChange={(v) => set("frequencyPenalty", v)} />
      <Slider label="Presence Penalty" value={draft.presencePenalty} min={-2} max={2} step={0.01} onChange={(v) => set("presencePenalty", v)} />
      <Slider label="Repetition Penalty" value={draft.repetitionPenalty} min={1} max={2} step={0.01} onChange={(v) => set("repetitionPenalty", v)} />
      <NumberField label="Max Context" value={draft.maxContext} onChange={(v) => set("maxContext", v)} />
      <NumberField label="Max Response Tokens" value={draft.maxTokens} onChange={(v) => set("maxTokens", v)} />
      <Toggle label="Stream responses" value={draft.stream} onChange={(v) => set("stream", v)} />
    </div>
  );
}

function AdvancedTab({ draft, set }: { draft: PresetDraft; set: SetFn }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Toggle label="Use system prompt" value={draft.useSysprompt} onChange={(v) => set("useSysprompt", v)} />
        <Toggle label="Squash system messages" value={draft.squashSystemMessages} onChange={(v) => set("squashSystemMessages", v)} />
        <Toggle label="Media inlining (images)" value={draft.mediaInlining} onChange={(v) => set("mediaInlining", v)} />
      </div>
      <Field label="Assistant prefill" hint="Forces the reply to begin with this text (Claude/OpenAI).">
        <textarea className="input resize-y font-mono text-[13px]" rows={2} value={draft.assistantPrefill} onChange={(e) => set("assistantPrefill", e.target.value)} />
      </Field>
      <PromptField label="Impersonation prompt" value={draft.impersonationPrompt} onChange={(v) => set("impersonationPrompt", v)} rows={2} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="New chat prompt"><input className="input" value={draft.newChatPrompt} onChange={(e) => set("newChatPrompt", e.target.value)} /></Field>
        <Field label="New example chat"><input className="input" value={draft.newExampleChatPrompt} onChange={(e) => set("newExampleChatPrompt", e.target.value)} /></Field>
      </div>
      <PromptField label="Continue nudge" value={draft.continueNudgePrompt} onChange={(v) => set("continueNudgePrompt", v)} rows={2} />
      <PromptField label="Group nudge" value={draft.groupNudgePrompt} onChange={(v) => set("groupNudgePrompt", v)} rows={2} />
      <div className="grid grid-cols-1 gap-3">
        <Field label="Scenario format"><input className="input font-mono text-[13px]" value={draft.scenarioFormat} onChange={(e) => set("scenarioFormat", e.target.value)} /></Field>
        <Field label="Personality format"><input className="input font-mono text-[13px]" value={draft.personalityFormat} onChange={(e) => set("personalityFormat", e.target.value)} /></Field>
        <Field label="World Info format"><input className="input font-mono text-[13px]" value={draft.wiFormat} onChange={(e) => set("wiFormat", e.target.value)} /></Field>
      </div>
    </>
  );
}

function LibraryPane({
  presets,
  onLoad,
  onDelete,
  editingId,
}: {
  presets: ReturnType<typeof useStore.getState>["presets"];
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  editingId: string | null;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      {presets.length === 0 && (
        <p className="py-8 text-center text-sm text-ink-faint">
          No saved presets yet. Build one and hit Save.
        </p>
      )}
      <div className="space-y-2">
        {presets.map((p) => (
          <div
            key={p.id}
            className={clsx(
              "flex items-center gap-2 rounded-lg border p-3",
              p.id === editingId ? "border-accent/50 bg-bg-elevated" : "border-line bg-bg-subtle/60"
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">{p.name}</div>
              <div className="text-[11px] text-ink-faint">
                temp {p.temperature} · {p.maxTokens} tok · {p.source}
              </div>
            </div>
            <button className="btn-soft text-xs" onClick={() => onLoad(p.id)}>
              Load
            </button>
            <button
              className="text-ink-faint transition hover:text-red-400"
              onClick={() => onDelete(p.id)}
              aria-label="Delete preset"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------- Field bits --------------------------- */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label className="text-sm font-medium text-ink">{label}</label>
        {hint && <span className="text-[11px] text-ink-faint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function PromptField({
  label,
  hint,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <Field label={label} hint={hint}>
      <textarea
        className="input resize-y font-mono text-[13px] leading-relaxed"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        className="input"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </Field>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-line bg-bg-subtle/60 px-3 py-2 text-sm">
      <span className="text-ink-muted">{label}</span>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-accent"
      />
    </label>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-ink-muted">
        <span>{label}</span>
        <span className="font-mono text-ink">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
    </div>
  );
}

function buildAIDraftPrompt(d: PresetDraft): string {
  return [
    "You are helping me design a SillyTavern Chat Completion preset.",
    "Here is my current draft of the three core prompts:",
    "",
    `Main Prompt:\n${d.mainPrompt || "(empty)"}`,
    "",
    `Auxiliary Prompt:\n${d.auxiliaryPrompt || "(empty)"}`,
    "",
    `Post-History Instructions:\n${d.postHistoryPrompt || "(empty)"}`,
    "",
    "Please improve these for clarity, character consistency, and strong roleplay/instruction-following.",
    "Return ONLY a JSON object with keys mainPrompt, auxiliaryPrompt, postHistoryPrompt so I can paste it back. Use {{char}} and {{user}} macros where appropriate.",
  ].join("\n");
}
