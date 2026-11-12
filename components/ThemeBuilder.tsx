"use client";

import { downloadFile } from "@/lib/download";

import { useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import {
  DEFAULT_THEME,
  ThemeDraft,
  buildTheme,
  parseTheme,
  themeFilename,
  parseRgba,
  rgbaToCss,
  rgbaToHex,
  hexToRgb,
} from "@/lib/sillytavern-theme";
import {
  X,
  Download,
  Upload,
  Copy,
  Check,
  Save,
  Trash2,
  Palette,
  Library,
  RotateCcw,
  FileJson,
} from "lucide-react";
import clsx from "clsx";

export function ThemeBuilder({ onClose }: { onClose: () => void }) {
  const themes = useStore((s) => s.themes);
  const saveTheme = useStore((s) => s.saveTheme);
  const removeTheme = useStore((s) => s.removeTheme);

  const [draft, setDraft] = useState<ThemeDraft>({ ...DEFAULT_THEME });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [tab, setTab] = useState<"colors" | "layout" | "css">("colors");
  const fileInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof ThemeDraft>(k: K, v: ThemeDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const json = useMemo(() => JSON.stringify(buildTheme(draft), null, 2), [draft]);

  const download = () => {
    downloadFile(json, themeFilename(draft.name), "application/json");
  };
  const copy = () =>
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  const importFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      setDraft(parseTheme(parsed, file.name.replace(/\.json$/i, "")));
      setEditingId(null);
    } catch (e: any) {
      alert(`Could not import theme: ${e.message || "invalid JSON"}`);
    }
  };
  const save = () => setEditingId(saveTheme(draft, editingId ?? undefined));
  const loadTheme = (id: string) => {
    const t = themes.find((x) => x.id === id);
    if (!t) return;
    const { id: _i, updatedAt: _u, ...rest } = t;
    setDraft(rest);
    setEditingId(id);
    setShowLibrary(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 p-0 backdrop-blur-sm sm:p-6">
      <div className="card flex w-full max-w-5xl animate-scale-in flex-col overflow-hidden sm:rounded-2xl">
        <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
          <Palette size={18} className="text-accent-soft" />
          <h2 className="text-base font-semibold">Theme Builder</h2>
          <span className="hidden text-xs text-ink-faint sm:inline">
            SillyTavern 1.18.0 UI theme
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <button className="btn-ghost text-xs" onClick={() => setShowLibrary((v) => !v)}>
              <Library size={15} /> Library
              {themes.length > 0 && (
                <span className="rounded-full bg-bg-elevated px-1.5 text-[10px]">{themes.length}</span>
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
            <div className="space-y-3 border-b border-line p-4">
              <div className="flex items-center gap-2">
                <FileJson size={16} className="shrink-0 text-ink-faint" />
                <input
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Theme name"
                  className="input font-medium"
                />
              </div>
              <div className="flex gap-1 rounded-lg bg-bg-subtle p-1">
                {(["colors", "layout", "css"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={clsx(
                      "flex-1 rounded-md px-3 py-1.5 text-sm capitalize transition",
                      tab === t ? "bg-bg-elevated text-ink shadow" : "text-ink-muted hover:text-ink"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              {tab === "colors" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <ColorField label="Main text" value={draft.mainText} onChange={(v) => set("mainText", v)} />
                  <ColorField label="Italics" value={draft.italicsText} onChange={(v) => set("italicsText", v)} />
                  <ColorField label="Quotes" value={draft.quoteText} onChange={(v) => set("quoteText", v)} />
                  <ColorField label="Underline" value={draft.underlineText} onChange={(v) => set("underlineText", v)} />
                  <ColorField label="Background tint" value={draft.blurTint} onChange={(v) => set("blurTint", v)} />
                  <ColorField label="Chat tint" value={draft.chatTint} onChange={(v) => set("chatTint", v)} />
                  <ColorField label="User bubble" value={draft.userMesBlurTint} onChange={(v) => set("userMesBlurTint", v)} />
                  <ColorField label="Bot bubble" value={draft.botMesBlurTint} onChange={(v) => set("botMesBlurTint", v)} />
                  <ColorField label="Shadow" value={draft.shadowColor} onChange={(v) => set("shadowColor", v)} />
                  <ColorField label="Border" value={draft.borderColor} onChange={(v) => set("borderColor", v)} />
                </div>
              )}
              {tab === "layout" && (
                <div className="space-y-4">
                  <Slider label="Blur strength" value={draft.blurStrength} min={0} max={30} step={1} onChange={(v) => set("blurStrength", v)} />
                  <Slider label="Shadow width" value={draft.shadowWidth} min={0} max={5} step={0.5} onChange={(v) => set("shadowWidth", v)} />
                  <Slider label="Font scale" value={draft.fontScale} min={0.6} max={1.8} step={0.05} onChange={(v) => set("fontScale", v)} />
                  <Slider label="Chat width (%)" value={draft.chatWidth} min={25} max={100} step={1} onChange={(v) => set("chatWidth", v)} />
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Toggle label="No shadows" value={draft.noShadows} onChange={(v) => set("noShadows", v)} />
                    <Toggle label="Reduced motion" value={draft.reducedMotion} onChange={(v) => set("reducedMotion", v)} />
                    <Toggle label="Compact input" value={draft.compactInputArea} onChange={(v) => set("compactInputArea", v)} />
                    <Toggle label="Hotswap bar" value={draft.hotswapEnabled} onChange={(v) => set("hotswapEnabled", v)} />
                    <Toggle label="Timestamps" value={draft.timestampsEnabled} onChange={(v) => set("timestampsEnabled", v)} />
                    <Toggle label="Model icon" value={draft.timestampModelIcon} onChange={(v) => set("timestampModelIcon", v)} />
                    <Toggle label="Token count" value={draft.messageTokenCountEnabled} onChange={(v) => set("messageTokenCountEnabled", v)} />
                    <Toggle label="Expand actions" value={draft.expandMessageActions} onChange={(v) => set("expandMessageActions", v)} />
                  </div>
                </div>
              )}
              {tab === "css" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-ink">Custom CSS</label>
                  <p className="mb-2 text-[11px] text-ink-faint">
                    Injected verbatim into SillyTavern. Target ST selectors like{" "}
                    <code>#chat</code>, <code>.mes_text</code>, <code>.mes[is_user=true]</code>.
                  </p>
                  <textarea
                    value={draft.customCss}
                    onChange={(e) => set("customCss", e.target.value)}
                    rows={14}
                    placeholder={"/* e.g. */\n.mes_text { line-height: 1.6; }"}
                    className="input resize-y font-mono text-[12px] leading-relaxed"
                    spellCheck={false}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-line p-3">
              <button className="btn-primary text-sm" onClick={download}>
                <Download size={15} /> Export .json
              </button>
              <button className="btn-soft text-sm" onClick={save}>
                <Save size={15} /> {editingId ? "Update" : "Save"}
              </button>
              <button className="btn-soft text-sm" onClick={() => fileInput.current?.click()}>
                <Upload size={15} /> Import
              </button>
              <input ref={fileInput} type="file" accept=".json,application/json" hidden
                onChange={(e) => { if (e.target.files?.[0]) importFile(e.target.files[0]); e.target.value = ""; }} />
              <div className="flex-1" />
              <button className="btn-ghost text-xs" onClick={() => { setDraft({ ...DEFAULT_THEME }); setEditingId(null); }}>
                <RotateCcw size={14} /> Reset
              </button>
            </div>
          </div>

          {/* Right: preview / library */}
          <div className="flex w-full min-h-0 flex-col lg:w-[42%]">
            {showLibrary ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {themes.length === 0 ? (
                  <p className="py-8 text-center text-sm text-ink-faint">No saved themes yet.</p>
                ) : (
                  <div className="space-y-2">
                    {themes.map((t) => (
                      <div key={t.id} className={clsx("flex items-center gap-2 rounded-lg border p-3",
                        t.id === editingId ? "border-accent/50 bg-bg-elevated" : "border-line bg-bg-subtle/60")}>
                        <span className="h-4 w-4 shrink-0 rounded-full border border-line" style={{ background: t.chatTint }} />
                        <div className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{t.name}</div>
                        <button className="btn-soft text-xs" onClick={() => loadTheme(t.id)}>Load</button>
                        <button className="text-ink-faint hover:text-red-400" onClick={() => removeTheme(t.id)} aria-label="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="border-b border-line px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-faint">
                  Live preview
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  <ThemePreview draft={draft} />
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wide text-ink-faint">Theme JSON</span>
                    <button className="btn-ghost text-xs" onClick={copy}>
                      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-[#0b0e16] p-3 font-mono text-[11px] text-ink-muted">
                    {json}
                  </pre>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ThemePreview({ draft }: { draft: ThemeDraft }) {
  const bubble = (who: "user" | "bot") => ({
    background: who === "user" ? draft.userMesBlurTint : draft.botMesBlurTint,
    color: draft.mainText,
    border: `1px solid ${draft.borderColor}`,
    boxShadow: draft.noShadows ? "none" : `0 0 ${draft.shadowWidth * 2}px ${draft.shadowColor}`,
    fontSize: `${13 * draft.fontScale}px`,
  });
  return (
    <div
      className="rounded-xl p-3"
      style={{ background: draft.blurTint, backdropFilter: `blur(${draft.blurStrength}px)` }}
    >
      <div className="space-y-2" style={{ maxWidth: `${draft.chatWidth}%`, marginInline: "auto" }}>
        <div className="rounded-lg p-2.5 leading-relaxed" style={bubble("bot")}>
          <div className="mb-0.5 text-[11px] font-semibold" style={{ color: draft.mainText }}>Seraphina</div>
          <span>She smiled. </span>
          <span style={{ color: draft.italicsText, fontStyle: "italic" }}>*a warm, knowing look*</span>{" "}
          <span style={{ color: draft.quoteText }}>&ldquo;You made it.&rdquo;</span>{" "}
          <span style={{ color: draft.underlineText, textDecoration: "underline" }}>Welcome home.</span>
        </div>
        <div className="rounded-lg p-2.5" style={bubble("user")}>
          <div className="mb-0.5 text-[11px] font-semibold" style={{ color: draft.mainText }}>You</div>
          <span style={{ color: draft.mainText }}>It&rsquo;s good to be back.</span>
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const c = parseRgba(value);
  const setHex = (hex: string) => {
    const { r, g, b } = hexToRgb(hex);
    onChange(rgbaToCss({ r, g, b, a: c.a }));
  };
  const setAlpha = (a: number) => onChange(rgbaToCss({ ...c, a }));
  return (
    <div className="rounded-lg border border-line bg-bg-subtle/60 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs text-ink-muted">{label}</span>
        <span className="h-4 w-8 rounded border border-line" style={{ background: value }} />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={rgbaToHex(c)}
          onChange={(e) => setHex(e.target.value)}
          className="h-7 w-9 shrink-0 cursor-pointer rounded border border-line bg-transparent"
        />
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={c.a}
          onChange={(e) => setAlpha(Number(e.target.value))}
          className="w-full accent-accent"
          title={`Opacity ${c.a}`}
        />
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-ink-muted">
        <span>{label}</span>
        <span className="font-mono text-ink">{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-accent" />
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-line bg-bg-subtle/60 px-3 py-2 text-xs">
      <span className="text-ink-muted">{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="accent-accent" />
    </label>
  );
}
