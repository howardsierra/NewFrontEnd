"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { PROVIDER_META, FALLBACK_MODELS } from "@/lib/providers";
import type { Conversation, ModelInfo } from "@/lib/types";
import {
  ChevronDown,
  Cpu,
  RefreshCw,
  SlidersHorizontal,
  Search,
  Menu,
  Gauge,
} from "lucide-react";
import clsx from "clsx";
import { conversationUsage, estimateContextTokens, formatTokens } from "@/lib/tokens";

export function ModelBar({
  conv,
  onToggleSidebar,
}: {
  conv: Conversation;
  onToggleSidebar: () => void;
}) {
  const providers = useStore((s) => s.providers);
  const setConversationProvider = useStore((s) => s.setConversationProvider);
  const setConversationModel = useStore((s) => s.setConversationModel);

  const provider = providers.find((p) => p.id === conv.providerId) ?? null;
  const enabledProviders = providers.filter((p) => p.enabled && p.apiKey);

  return (
    <div className="flex items-center gap-2 border-b border-line bg-bg-subtle/70 px-3 py-2.5 backdrop-blur">
      <button
        className="btn-ghost px-2 lg:hidden"
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
      >
        <Menu size={18} />
      </button>

      {/* Provider picker */}
      <Dropdown
        label={provider?.label ?? "Provider"}
        accent={provider ? PROVIDER_META[provider.kind].accent : undefined}
        icon={
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: provider ? PROVIDER_META[provider.kind].accent : "#5e6680" }}
          />
        }
      >
        {(close) => (
          <div className="py-1">
            {enabledProviders.length === 0 && (
              <p className="px-3 py-2 text-xs text-ink-faint">
                No providers with keys. Add one in settings.
              </p>
            )}
            {enabledProviders.map((p) => (
              <button
                key={p.id}
                className={clsx(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg-elevated",
                  p.id === conv.providerId && "text-accent-soft"
                )}
                onClick={() => {
                  setConversationProvider(conv.id, p.id, p.defaultModel ?? null);
                  close();
                }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: PROVIDER_META[p.kind].accent }}
                />
                {p.label}
              </button>
            ))}
          </div>
        )}
      </Dropdown>

      {/* Model picker */}
      <ModelPicker
        conv={conv}
        onPick={(m) => setConversationModel(conv.id, m)}
      />

      <div className="flex-1" />

      <TokenMeter conv={conv} />
      <ParamsButton conv={conv} />
    </div>
  );
}

function TokenMeter({ conv }: { conv: Conversation }) {
  const usage = conversationUsage(conv);
  const contextEst = estimateContextTokens(conv);

  return (
    <div
      className="hidden items-center gap-2 rounded-lg border border-line bg-bg-elevated px-2.5 py-1.5 text-xs sm:flex"
      title={
        usage.hasReal
          ? `Reported usage this chat — prompt ${usage.input}, completion ${usage.output} tokens. Next request ≈ ${contextEst} input tokens (estimated).`
          : `Estimated context for the next request: ~${contextEst} tokens. Real usage appears after your first reply.`
      }
    >
      <Gauge size={14} className="text-accent-soft" />
      {usage.hasReal ? (
        <span className="font-mono text-ink-muted">
          <span className="text-ink">{formatTokens(usage.input + usage.output)}</span> tok
          <span className="text-ink-faint"> · ~{formatTokens(contextEst)} ctx</span>
        </span>
      ) : (
        <span className="font-mono text-ink-muted">~{formatTokens(contextEst)} ctx</span>
      )}
    </div>
  );
}

function ModelPicker({
  conv,
  onPick,
}: {
  conv: Conversation;
  onPick: (model: string) => void;
}) {
  const providers = useStore((s) => s.providers);
  const modelCache = useStore((s) => s.modelCache);
  const setModelCache = useStore((s) => s.setModelCache);
  const provider = providers.find((p) => p.id === conv.providerId) ?? null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const cached = provider ? modelCache[provider.id] : undefined;
  const fallback: ModelInfo[] = provider
    ? FALLBACK_MODELS[provider.kind].map((id) => ({ id }))
    : [];
  const models = cached && cached.length ? cached : fallback;

  const fetchModels = async () => {
    if (!provider || !provider.apiKey) {
      setError("Add an API key for this provider first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: provider.kind,
          apiKey: provider.apiKey,
          baseUrl: provider.baseUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to list models");
      setModelCache(provider.id, data.models ?? []);
    } catch (e: any) {
      setError(e.message || "Failed to list models");
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch once when a provider is selected and nothing cached.
  useEffect(() => {
    if (provider && provider.apiKey && !cached) fetchModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider?.id]);

  const filtered = query
    ? models.filter((m) => m.id.toLowerCase().includes(query.toLowerCase()))
    : models;

  return (
    <Dropdown
      label={conv.model ?? "Select model"}
      icon={<Cpu size={14} className="text-ink-muted" />}
      mono
      wide
    >
      {(close) => (
        <div className="flex max-h-[60vh] w-80 flex-col">
          <div className="flex items-center gap-2 border-b border-line p-2">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint"
              />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search or type a model id…"
                className="input py-1.5 pl-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && query.trim()) {
                    onPick(query.trim());
                    close();
                  }
                }}
              />
            </div>
            <button
              className="btn-ghost px-2"
              onClick={fetchModels}
              disabled={loading}
              aria-label="Refresh models"
              title="Refresh model list"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          {error && (
            <p className="px-3 py-2 text-xs text-red-400/90">{error}</p>
          )}

          <div className="flex-1 overflow-y-auto py-1">
            {filtered.length === 0 && !loading && (
              <p className="px-3 py-3 text-xs text-ink-faint">
                {query
                  ? `Press Enter to use "${query}"`
                  : "No models cached. Hit refresh."}
              </p>
            )}
            {filtered.map((m) => (
              <button
                key={m.id}
                className={clsx(
                  "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-bg-elevated",
                  m.id === conv.model && "text-accent-soft"
                )}
                onClick={() => {
                  onPick(m.id);
                  close();
                }}
              >
                <span className="truncate font-mono text-[13px]">{m.id}</span>
                {m.contextLength ? (
                  <span className="shrink-0 text-[10px] text-ink-faint">
                    {Math.round(m.contextLength / 1000)}k
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      )}
    </Dropdown>
  );
}

function ParamsButton({ conv }: { conv: Conversation }) {
  const updateParams = useStore((s) => s.updateParams);
  const p = conv.params;

  return (
    <Dropdown
      label="Params"
      icon={<SlidersHorizontal size={14} />}
      align="right"
    >
      {() => (
        <div className="w-80 space-y-4 p-4">
          <Slider
            label="Temperature"
            value={p.temperature}
            min={0}
            max={2}
            step={0.05}
            onChange={(v) => updateParams(conv.id, { temperature: v })}
          />
          <Slider
            label="Top P"
            value={p.topP}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => updateParams(conv.id, { topP: v })}
          />
          <div>
            <div className="mb-1 flex justify-between text-xs text-ink-muted">
              <span>Max tokens</span>
            </div>
            <input
              type="number"
              min={1}
              value={p.maxTokens}
              onChange={(e) =>
                updateParams(conv.id, { maxTokens: Math.max(1, Number(e.target.value) || 1) })
              }
              className="input"
            />
          </div>
          <div>
            <div className="mb-1 text-xs text-ink-muted">System prompt</div>
            <textarea
              value={p.systemPrompt}
              onChange={(e) => updateParams(conv.id, { systemPrompt: e.target.value })}
              placeholder="You are a helpful assistant…"
              rows={5}
              className="input resize-y font-mono text-[13px]"
            />
          </div>
        </div>
      )}
    </Dropdown>
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
        <span className="font-mono text-ink">{value.toFixed(2)}</span>
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

/** Lightweight click-outside dropdown. */
function Dropdown({
  label,
  icon,
  accent,
  children,
  mono,
  wide,
  align = "left",
}: {
  label: string;
  icon?: React.ReactNode;
  accent?: string;
  children: (close: () => void) => React.ReactNode;
  mono?: boolean;
  wide?: boolean;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        className="btn-soft max-w-[44vw] sm:max-w-xs"
        onClick={() => setOpen((v) => !v)}
        style={accent ? { borderColor: `${accent}55` } : undefined}
      >
        {icon}
        <span className={clsx("truncate", mono && "font-mono text-[13px]")}>
          {label}
        </span>
        <ChevronDown size={14} className="shrink-0 opacity-60" />
      </button>
      {open && (
        <div
          className={clsx(
            "absolute z-40 mt-1.5 min-w-[12rem] overflow-hidden rounded-xl border border-line bg-bg-panel shadow-2xl animate-fade-in",
            wide && "min-w-[20rem]",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
