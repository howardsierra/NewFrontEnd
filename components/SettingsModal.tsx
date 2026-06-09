"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { PROVIDER_META } from "@/lib/providers";
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
} from "lucide-react";
import clsx from "clsx";

const ADDABLE: ProviderKind[] = ["openrouter", "anthropic", "openai", "custom"];

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const providers = useStore((s) => s.providers);
  const addProvider = useStore((s) => s.addProvider);

  const quickAdd = (kind: ProviderKind) => {
    const meta = PROVIDER_META[kind];
    addProvider({
      kind,
      label: meta.label,
      apiKey: "",
      baseUrl: kind === "custom" ? "" : meta.baseUrl,
      enabled: true,
    });
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

        <div className="max-h-[60vh] space-y-3 overflow-y-auto p-5">
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
            {ADDABLE.map((kind) => (
              <button
                key={kind}
                onClick={() => quickAdd(kind)}
                className="btn-soft"
                style={{ borderColor: `${PROVIDER_META[kind].accent}55` }}
              >
                <Plus size={14} />
                {PROVIDER_META[kind].label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProviderRow({ provider }: { provider: ProviderConfig }) {
  const updateProvider = useStore((s) => s.updateProvider);
  const removeProvider = useStore((s) => s.removeProvider);
  const [show, setShow] = useState(false);
  const meta = PROVIDER_META[provider.kind];

  return (
    <div className="rounded-lg border border-line bg-bg-subtle/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: meta.accent }}
        />
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

      <p className="mb-2 text-xs text-ink-faint">{meta.hint}</p>

      <div className="space-y-2">
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            value={provider.apiKey}
            placeholder="API key"
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

        {provider.kind === "custom" && (
          <input
            value={provider.baseUrl ?? ""}
            placeholder="Base URL, e.g. http://localhost:1234/v1"
            onChange={(e) => updateProvider(provider.id, { baseUrl: e.target.value })}
            className="input font-mono"
            spellCheck={false}
          />
        )}

        <div className="flex items-center justify-between">
          <input
            value={provider.defaultModel ?? ""}
            placeholder="Default model (optional)"
            onChange={(e) => updateProvider(provider.id, { defaultModel: e.target.value })}
            className="input mr-2 font-mono"
            spellCheck={false}
          />
          {meta.keysUrl && (
            <a
              href={meta.keysUrl}
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
