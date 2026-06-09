"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { PROVIDER_META, CUSTOM_PRESETS, CustomPreset } from "@/lib/providers";
import type { ProviderConfig, ProviderKind } from "@/lib/types";
import {
  X,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  ShieldCheck,
  PlugZap,
  Check,
  AlertTriangle,
  Loader2,
  ChevronDown,
  Settings2,
} from "lucide-react";
import clsx from "clsx";

const NATIVE: ProviderKind[] = ["openrouter", "anthropic", "openai"];

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const providers = useStore((s) => s.providers);
  const addProvider = useStore((s) => s.addProvider);
  const [customMenu, setCustomMenu] = useState(false);

  const addNative = (kind: ProviderKind) => {
    const meta = PROVIDER_META[kind];
    addProvider({
      kind,
      label: meta.label,
      apiKey: "",
      baseUrl: meta.baseUrl,
      keysUrl: meta.keysUrl,
      enabled: true,
    });
  };

  const addCustom = (preset: CustomPreset) => {
    addProvider({
      kind: "custom",
      label: preset.id === "blank" ? "Custom provider" : preset.label,
      apiKey: "",
      baseUrl: preset.baseUrl,
      defaultModel: preset.defaultModel,
      hint: preset.hint,
      keysUrl: preset.keysUrl,
      enabled: true,
    });
    setCustomMenu(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:p-8">
      <div className="card w-full max-w-2xl animate-fade-in shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-accent-soft" />
            <h2 className="text-base font-semibold">Providers & API keys</h2>
          </div>
          <button className="btn-ghost px-2" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex items-start gap-2 border-b border-line bg-bg-subtle/50 px-5 py-3 text-xs text-ink-muted">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-green-400/80" />
          <p>
            Keys are stored only in this browser (localStorage) and sent directly to a
            thin proxy that forwards them to the provider. They are never persisted on a
            server.
          </p>
        </div>

        <div className="max-h-[58vh] space-y-3 overflow-y-auto p-5">
          {providers.length === 0 && (
            <p className="py-4 text-center text-sm text-ink-faint">
              Add a provider to get started.
            </p>
          )}
          {providers.map((p) => (
            <ProviderRow key={p.id} provider={p} />
          ))}
        </div>

        <div className="border-t border-line px-5 py-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
            Add provider
          </p>
          <div className="flex flex-wrap gap-2">
            {NATIVE.map((kind) => (
              <button
                key={kind}
                onClick={() => addNative(kind)}
                className="btn-soft"
                style={{ borderColor: `${PROVIDER_META[kind].accent}55` }}
              >
                <Plus size={14} />
                {PROVIDER_META[kind].label}
              </button>
            ))}

            {/* OpenAI-compatible custom presets */}
            <div className="relative">
              <button
                onClick={() => setCustomMenu((v) => !v)}
                className="btn-soft"
              >
                <Plus size={14} />
                OpenAI-compatible
                <ChevronDown size={13} className="opacity-60" />
              </button>
              {customMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setCustomMenu(false)}
                  />
                  <div className="absolute bottom-full z-20 mb-1.5 max-h-72 w-64 overflow-y-auto rounded-xl border border-line bg-bg-panel p-1 shadow-2xl animate-fade-in">
                    <p className="px-3 py-1.5 text-[11px] text-ink-faint">
                      Pick a service — base URL is prefilled, just add your key.
                    </p>
                    {CUSTOM_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => addCustom(preset)}
                        className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-bg-elevated"
                      >
                        <span className="text-ink">{preset.label}</span>
                        {preset.baseUrl && (
                          <span className="truncate font-mono text-[10px] text-ink-faint">
                            {preset.baseUrl}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; count: number }
  | { status: "error"; message: string };

function ProviderRow({ provider }: { provider: ProviderConfig }) {
  const updateProvider = useStore((s) => s.updateProvider);
  const removeProvider = useStore((s) => s.removeProvider);
  const setModelCache = useStore((s) => s.setModelCache);
  const [show, setShow] = useState(false);
  const [test, setTest] = useState<TestState>({ status: "idle" });
  const [showHeaders, setShowHeaders] = useState(
    !!provider.headers && Object.keys(provider.headers).length > 0
  );
  const [headersText, setHeadersText] = useState(
    provider.headers ? JSON.stringify(provider.headers, null, 2) : ""
  );
  const [headersError, setHeadersError] = useState<string | null>(null);

  const meta = PROVIDER_META[provider.kind];
  const isCustom = provider.kind === "custom";
  const hint = provider.hint ?? meta.hint;
  const keysUrl = provider.keysUrl ?? meta.keysUrl;

  const commitHeaders = (text: string) => {
    setHeadersText(text);
    if (!text.trim()) {
      setHeadersError(null);
      updateProvider(provider.id, { headers: undefined });
      return;
    }
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) headers[k] = String(v);
        setHeadersError(null);
        updateProvider(provider.id, { headers });
      } else {
        setHeadersError("Must be a JSON object.");
      }
    } catch {
      setHeadersError("Invalid JSON.");
    }
  };

  const testConnection = async () => {
    setTest({ status: "testing" });
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: provider.kind,
          apiKey: provider.apiKey,
          baseUrl: provider.baseUrl,
          headers: provider.headers,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const models = data.models ?? [];
      setModelCache(provider.id, models);
      setTest({ status: "ok", count: models.length });
    } catch (e: any) {
      setTest({ status: "error", message: e.message || "Connection failed" });
    }
  };

  return (
    <div className="rounded-lg border border-line bg-bg-subtle/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.accent }} />
        <input
          value={provider.label}
          onChange={(e) => updateProvider(provider.id, { label: e.target.value })}
          className="flex-1 bg-transparent text-sm font-medium text-ink outline-none"
        />
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={provider.enabled}
            onChange={(e) => updateProvider(provider.id, { enabled: e.target.checked })}
            className="accent-accent"
          />
          enabled
        </label>
        <button
          className="text-ink-faint transition hover:text-red-400"
          onClick={() => removeProvider(provider.id)}
          aria-label="Remove provider"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <p className="mb-2 text-xs text-ink-faint">{hint}</p>

      <div className="space-y-2">
        {isCustom && (
          <input
            value={provider.baseUrl ?? ""}
            placeholder="Base URL, e.g. https://api.groq.com/openai/v1"
            onChange={(e) => updateProvider(provider.id, { baseUrl: e.target.value })}
            className="input font-mono"
            spellCheck={false}
          />
        )}

        <div className="relative">
          <input
            type={show ? "text" : "password"}
            value={provider.apiKey}
            placeholder={isCustom ? "API key (leave blank for local servers)" : "API key"}
            onChange={(e) => updateProvider(provider.id, { apiKey: e.target.value })}
            className="input pr-10 font-mono"
            spellCheck={false}
            autoComplete="off"
          />
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
            onClick={() => setShow((v) => !v)}
            type="button"
            aria-label={show ? "Hide key" : "Show key"}
          >
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>

        {isCustom && (
          <div>
            <button
              className="flex items-center gap-1.5 text-xs text-ink-faint hover:text-ink-muted"
              onClick={() => setShowHeaders((v) => !v)}
            >
              <Settings2 size={13} />
              Custom headers {showHeaders ? "▾" : "▸"}
            </button>
            {showHeaders && (
              <>
                <textarea
                  value={headersText}
                  onChange={(e) => commitHeaders(e.target.value)}
                  placeholder={'{\n  "api-key": "..."\n}'}
                  rows={3}
                  className="input mt-1.5 resize-y font-mono text-[12px]"
                  spellCheck={false}
                />
                {headersError && (
                  <p className="mt-1 text-[11px] text-red-400/90">{headersError}</p>
                )}
                <p className="mt-1 text-[11px] text-ink-faint">
                  Extra request headers as JSON (e.g. Azure’s <code>api-key</code>).
                </p>
              </>
            )}
          </div>
        )}

        <input
          value={provider.defaultModel ?? ""}
          placeholder="Default model (optional)"
          onChange={(e) => updateProvider(provider.id, { defaultModel: e.target.value })}
          className="input font-mono"
          spellCheck={false}
        />

        <div className="flex items-center gap-2 pt-0.5">
          <button
            className="btn-soft text-xs"
            onClick={testConnection}
            disabled={test.status === "testing" || (isCustom && !provider.baseUrl)}
          >
            {test.status === "testing" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <PlugZap size={13} />
            )}
            Test connection
          </button>

          {test.status === "ok" && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <Check size={13} /> {test.count} models
            </span>
          )}
          {test.status === "error" && (
            <span
              className="flex items-center gap-1 truncate text-xs text-red-400"
              title={test.message}
            >
              <AlertTriangle size={13} /> {test.message}
            </span>
          )}

          <div className="flex-1" />

          {keysUrl && (
            <a
              href={keysUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={clsx(
                "btn-ghost shrink-0 whitespace-nowrap text-xs",
                "text-accent-soft hover:text-accent"
              )}
            >
              Get key <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
