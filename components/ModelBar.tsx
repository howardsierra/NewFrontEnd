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
  Sun,
  Moon,
  Drama,
} from "lucide-react";
import clsx from "clsx";
import { conversationUsage, estimateContextTokens, formatTokens } from "@/lib/tokens";
import { conversationCost, formatCost } from "@/lib/pricing";

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
  const enabledProviders = providers.filter(
    (p) => p.enabled && (p.kind === "custom" ? !!p.baseUrl : !!p.apiKey)
  );

  return (
    <div className="flex items-center gap-2 border-b border-line/70 bg-bg-subtle/50 px-3 py-3 backdrop-blur-xl">
      <button
        className="btn-ghost px-2 lg:hidden"
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
      >
        <Menu size={18} />
      </button>

      {/* Provider picker — Flux-style logo pill */}
      <Dropdown
        label={provider?.label ?? "No connection"}
        accent={provider ? PROVIDER_META[provider.kind].accent : undefined}
        icon={
          <span
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[12px] font-bold text-white"
            style={{ background: provider ? PROVIDER_META[provider.kind].accent : "#5e6680" }}
          >
            {(provider?.label ?? "?").slice(0, 1).toUpperCase()}
          </span>
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
                  "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-bg-elevated",
                  p.id === conv.providerId && "text-accent-soft"
                )}
                onClick={() => {
                  setConversationProvider(conv.id, p.id, p.defaultModel ?? null);
                  close();
                }}
              >
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-bold text-white"
                  style={{ background: PROVIDER_META[p.kind].accent }}
                >
                  {p.label.slice(0, 1).toUpperCase()}
                </span>
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

      <PersonaPill conv={conv} />

      <div className="flex-1" />

      <span className="hidden items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-muted md:flex">
        <span className="h-1.5 w-1.5 rounded-full bg-green-400/80" />
        Private
      </span>
      <ThemeToggle />
      <TokenMeter conv={conv} />
      <ParamsButton conv={conv} />
    </div>
  );
}

function PersonaPill({ conv }: { conv: Conversation }) {
  const personas = useStore((s) => s.personas);
  const setConversationPersona = useStore((s) => s.setConversationPersona);
  const active = personas.find((p) => p.id === conv.personaId) ?? null;

  return (
    <Dropdown
      label={active ? active.name : "Persona"}
      icon={<span className="text-[15px] leading-none">{active ? active.emoji : "🎭"}</span>}
    >
      {(close) => (
        <div className="w-60 py-1">
          <button
            className={clsx(
              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg-elevated",
              !conv.personaId && "text-accent-soft"
            )}
            onClick={() => {
              setConversationPersona(conv.id, null);
              close();
            }}
          >
            <span className="text-ink-faint">∅</span> No persona
          </button>
          {personas.map((p) => (
            <button
              key={p.id}
              className={clsx(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg-elevated",
                p.id === conv.personaId && "text-accent-soft"
              )}
              onClick={() => {
                setConversationPersona(conv.id, p.id);
                close();
              }}
            >
              <span className="text-[15px] leading-none">{p.emoji}</span>
              <span className="truncate">{p.name}</span>
            </button>
          ))}
          <button
            className="mt-1 flex w-full items-center gap-2 border-t border-line px-3 py-2 text-left text-sm text-accent-soft hover:bg-bg-elevated"
            onClick={() => {
              document.dispatchEvent(new CustomEvent("open-personas"));
              close();
            }}
          >
            <Drama size={14} /> Manage personas…
          </button>
        </div>
      )}
    </Dropdown>
  );
}

function ThemeToggle() {
  const uiTheme = useStore((s) => s.uiTheme);
  const setUiTheme = useStore((s) => s.setUiTheme);
  return (
    <button
      className="btn-ghost px-2"
      onClick={() => setUiTheme(uiTheme === "dark" ? "light" : "dark")}
      title={uiTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      aria-label="Toggle theme"
    >
      {uiTheme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

function TokenMeter({ conv }: { conv: Conversation }) {
  const usage = conversationUsage(conv);
  const contextEst = estimateContextTokens(conv);
  const cost = conversationCost(conv);

  return (
    <div
      className="hidden items-center gap-2 rounded-lg border border-line bg-bg-elevated px-2.5 py-1.5 text-xs sm:flex"
      title={
        usage.hasReal
          ? `Reported usage this chat — prompt ${usage.input}, completion ${usage.output} tokens. ${
              cost.hasCost ? `Estimated spend ${formatCost(cost.total)}. ` : ""
            }Next request ≈ ${contextEst} input tokens (estimated).`
          : `Estimated context for the next request: ~${contextEst} tokens. Real usage and cost appear after your first reply.`
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
      {cost.hasCost && (
        <span className="border-l border-line pl-2 font-mono text-green-400/80">
          {formatCost(cost.total)}
        </span>
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
    if (!provider) return;
    // Custom/local servers may not need a key; everything else does.
    if (provider.kind !== "custom" && !provider.apiKey) {
      setError("Add an API key for this provider first.");
      return;
    }
    if (provider.kind === "custom" && !provider.baseUrl) {
      setError("Set the base URL for this custom provider.");
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
          headers: provider.headers,
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
    if (!provider || cached) return;
    const ready =
      provider.kind === "custom" ? !!provider.baseUrl : !!provider.apiKey;
    if (ready) fetchModels();
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
                <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-ink-faint">
                  {m.pricing && (
                    <span className="text-green-400/70" title="USD per 1M tokens (in / out)">
                      ${trimPrice(m.pricing.input)}/${trimPrice(m.pricing.output)}
                    </span>
                  )}
                  {m.contextLength ? <span>{Math.round(m.contextLength / 1000)}k</span> : null}
                </span>
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

/** Trim a per-1M price to a compact label (e.g. 2.5, 0.15, 75). */
function trimPrice(n: number): string {
  if (n >= 10) return String(Math.round(n));
  if (n >= 1) return n.toFixed(1).replace(/\.0$/, "");
  return n.toFixed(2).replace(/0$/, "");
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
