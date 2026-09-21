"use client";

import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import {
  buildBackup,
  validateBackup,
  backupFilename,
  BackupFile,
  ImportSummary,
} from "@/lib/backup";
import {
  X,
  Download,
  Upload,
  Copy,
  Check,
  DatabaseBackup,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";
import clsx from "clsx";

export function BackupModal({ onClose }: { onClose: () => void }) {
  const providers = useStore((s) => s.providers);
  const presets = useStore((s) => s.presets);
  const snippets = useStore((s) => s.snippets);
  const themes = useStore((s) => s.themes);
  const regexScripts = useStore((s) => s.regexScripts);
  const personas = useStore((s) => s.personas);
  const conversations = useStore((s) => s.conversations);
  const importBackup = useStore((s) => s.importBackup);

  const [includeKeys, setIncludeKeys] = useState(true);
  const [includeConversations, setIncludeConversations] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [result, setResult] = useState<
    | { kind: "ok"; summary: ImportSummary; mode: "merge" | "replace" }
    | { kind: "error"; message: string }
    | null
  >(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const makeFile = (): BackupFile =>
    buildBackup(
      { providers, presets, snippets, themes, regexScripts, personas, conversations },
      { includeKeys, includeConversations }
    );

  const download = () => {
    const blob = new Blob([JSON.stringify(makeFile(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupFilename();
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = () => {
    navigator.clipboard
      .writeText(JSON.stringify(makeFile(), null, 2))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
  };

  const handleImport = async (file: File) => {
    setResult(null);
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      setResult({ kind: "error", message: "That file isn't valid JSON." });
      return;
    }
    const v = validateBackup(json);
    if (!v.ok) {
      setResult({ kind: "error", message: v.error });
      return;
    }
    if (
      mode === "replace" &&
      !confirm(
        "Replace mode overwrites all current providers, presets, and snippets with the backup. Continue?"
      )
    ) {
      return;
    }
    const summary = importBackup(v.data, mode);
    setResult({ kind: "ok", summary, mode });
  };

  const convCount = conversations.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:p-8">
      <div className="card w-full max-w-xl animate-fade-in shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <DatabaseBackup size={18} className="text-accent-soft" />
            <h2 className="text-base font-semibold">Backup & restore</h2>
          </div>
          <button className="btn-ghost px-2" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* Export */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink">Export</h3>
            <div className="mb-3 flex flex-wrap gap-2 text-xs text-ink-muted">
              <span className="chip">{providers.length} providers</span>
              <span className="chip">{presets.length} presets</span>
              <span className="chip">{snippets.length} snippets</span>
              <span className="chip">{themes.length} themes</span>
              <span className="chip">{regexScripts.length} regex</span>
              <span className="chip">{personas.length} personas</span>
              {includeConversations && (
                <span className="chip">{convCount} conversations</span>
              )}
            </div>

            <div className="space-y-2">
              <ToggleRow
                checked={includeKeys}
                onChange={setIncludeKeys}
                label="Include API keys & custom headers"
              />
              <ToggleRow
                checked={includeConversations}
                onChange={setIncludeConversations}
                label={`Include conversations (${convCount})`}
              />
            </div>

            {includeKeys && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
                <ShieldAlert size={15} className="mt-0.5 shrink-0" />
                <p>
                  This file will contain your API keys in plain text. Store it
                  somewhere safe and don’t share it. Turn the toggle off to export
                  a key-free config you can share.
                </p>
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <button className="btn-primary text-sm" onClick={download}>
                <Download size={15} /> Download backup
              </button>
              <button className="btn-soft text-sm" onClick={copy}>
                {copied ? (
                  <Check size={15} className="text-green-400" />
                ) : (
                  <Copy size={15} />
                )}
                {copied ? "Copied" : "Copy JSON"}
              </button>
            </div>
          </section>

          <div className="h-px bg-line" />

          {/* Import */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink">Restore</h3>

            <div className="mb-3 flex gap-2">
              <ModeButton
                active={mode === "merge"}
                onClick={() => setMode("merge")}
                title="Merge"
                desc="Keep what you have, add new items"
              />
              <ModeButton
                active={mode === "replace"}
                onClick={() => setMode("replace")}
                title="Replace"
                desc="Overwrite everything with the backup"
              />
            </div>

            <button
              className="btn-soft w-full text-sm"
              onClick={() => fileInput.current?.click()}
            >
              <Upload size={15} /> Choose backup file…
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                if (e.target.files?.[0]) handleImport(e.target.files[0]);
                e.target.value = "";
              }}
            />

            {result?.kind === "ok" && (
              <div className="mt-3 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-200/90">
                <p className="flex items-center gap-1.5 font-medium">
                  <Check size={14} /> Restore complete ({result.mode})
                </p>
                <p className="mt-1 text-green-200/70">
                  {result.mode === "replace" ? "Loaded" : "Added"}{" "}
                  {result.summary.providers} providers, {result.summary.presets}{" "}
                  presets, {result.summary.snippets} snippets,{" "}
                  {result.summary.themes} themes, {result.summary.regexScripts} regex,{" "}
                  {result.summary.personas} personas
                  {result.summary.conversations
                    ? `, ${result.summary.conversations} conversations`
                    : ""}
                  {result.summary.skipped
                    ? ` · skipped ${result.summary.skipped} duplicates`
                    : ""}
                  .
                </p>
              </div>
            )}
            {result?.kind === "error" && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>{result.message}</span>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-line bg-bg-subtle/60 px-3 py-2 text-sm">
      <span className="text-ink-muted">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-accent"
      />
    </label>
  );
}

function ModeButton({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex-1 rounded-lg border p-3 text-left transition",
        active
          ? "border-accent/60 bg-bg-elevated"
          : "border-line bg-bg-subtle/60 hover:border-line"
      )}
    >
      <div className="text-sm font-medium text-ink">{title}</div>
      <div className="mt-0.5 text-[11px] text-ink-faint">{desc}</div>
    </button>
  );
}
