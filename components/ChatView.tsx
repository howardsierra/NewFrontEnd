"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Conversation } from "@/lib/types";
import { MessageItem } from "./MessageItem";
import { Composer } from "./Composer";
import { ModelBar } from "./ModelBar";
import { useChat } from "@/lib/useChat";
import { useStore } from "@/lib/store";
import { visionSupport } from "@/lib/vision";
import { hydrateImages, useSyncStatus } from "@/lib/sync/engine";
import clsx from "clsx";
import { downloadConversation } from "@/lib/export-chat";
import { Download, Sparkles, ArrowUpRight, Settings2, FileText, Code2, Wand2, Lightbulb, ArrowDown } from "lucide-react";

const SUGGESTIONS = [
  {
    icon: Wand2,
    tile: "violet",
    title: "Draft a SillyTavern preset",
    desc: "Personas, tone, sampler settings",
    prompt:
      "Help me build a SillyTavern preset. Ask me about the persona, tone, and formatting rules, then output the system prompt and recommended sampler settings.",
  },
  {
    icon: Code2,
    tile: "blue",
    title: "Build something",
    desc: "Code, components, or prototypes",
    prompt:
      "I'll attach some HTML/CSS/JS files. Review them for bugs, accessibility, and performance, then suggest concrete fixes.",
  },
  {
    icon: FileText,
    tile: "peach",
    title: "Summarize a document",
    desc: "PDFs, notes, or long threads",
    prompt:
      "I'll attach a PDF. Give me a tight executive summary with the key points and any action items.",
  },
  {
    icon: Lightbulb,
    tile: "green",
    title: "Brainstorm ideas",
    desc: "Think through concepts and angles",
    prompt: "Brainstorm ten fresh, non-obvious ideas for my project and note the main risk of each.",
  },
];

const TILE: Record<string, string> = {
  peach: "bg-[#f9eae0] text-[#985033]",
  blue: "bg-[#e4eef9] text-[#3d638c]",
  violet: "bg-[#eee8fa] text-[#70539d]",
  green: "bg-[#e4f2e8] text-[#3d6d4c]",
};

export function ChatView({ conv }: { conv: Conversation }) {
  const { send, stop, regenerate, generateImage, retry, branchAndSend, busy } = useChat();
  const providers = useStore((s) => s.providers);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Follow the stream only while the reader is at (or near) the bottom.
  const stickRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  const provider = providers.find((p) => p.id === conv.providerId);
  const providerReady = !!provider && provider.enabled && (
    provider.kind === "custom" ? !!provider.baseUrl : !!provider.apiKey
  );
  const ready = providerReady && !!conv.model;

  const modelCache = useStore((s) => s.modelCache);
  const imageWarning =
    provider && conv.model &&
    visionSupport(provider.kind, conv.model, modelCache[provider.id]) === "no"
      ? `${conv.model} can't see images, so it will ignore this one. Pick a vision model (GPT-4o, Claude, Gemini…) in the top bar.`
      : undefined;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = true;
    setAtBottom(true);
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const lastTopRef = useRef(0);
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const top = el.scrollTop;
    const near = el.scrollHeight - top - el.clientHeight < 96;
    if (near) {
      stickRef.current = true;
      setAtBottom(true);
    } else if (top < lastTopRef.current - 2) {
      // Only an upward scroll means "I'm reading back". Programmatic scrolls
      // toward the bottom (and content growing while streaming) never unstick.
      stickRef.current = false;
      setAtBottom(false);
    }
    lastTopRef.current = top;
  };

  // Fetch images this device doesn't hold from the synced vault.
  const syncedAt = useSyncStatus((s) => s.lastSync);
  useEffect(() => {
    void hydrateImages(conv.id);
  }, [conv.id, syncedAt]);

  // Jump to the latest message when switching conversations.
  useEffect(() => {
    scrollToBottom("auto");
  }, [conv.id, scrollToBottom]);

  // New messages (e.g. you just sent one) always bring you to the bottom.
  useEffect(() => {
    scrollToBottom("smooth");
  }, [conv.messages.length, scrollToBottom]);

  // While streaming, follow along only if you haven't scrolled up.
  const lastContent =
    conv.messages[conv.messages.length - 1]?.content.length ?? 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [lastContent]);

  const hasMessages = conv.messages.length > 0;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ModelBar
        conv={conv}
        onToggleSidebar={() =>
          document.dispatchEvent(new CustomEvent("toggle-sidebar"))
        }
      />

      {hasMessages && (
        <div className="flex items-center justify-between gap-3 border-b border-line/50 px-4 py-2 sm:px-6">
          <div className="min-w-0"><p className="truncate text-sm font-medium">{conv.title}</p>
            <p className="text-[11px] text-ink-faint">{conv.messages.length} messages</p></div>
          <button className="btn-ghost shrink-0 text-xs" onClick={() => downloadConversation(conv)} title="Export conversation as Markdown">
            <Download size={14} /> Export chat
          </button>
        </div>
      )}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain"
        >
          {!hasMessages ? (
            <Welcome
              onPick={(p) => document.dispatchEvent(new CustomEvent("insert-snippet", { detail: p }))}
              ready={ready}
            />
          ) : (
            <div className="mx-auto max-w-3xl space-y-6 px-3 py-6 sm:space-y-8 sm:px-4 sm:py-8">
              {conv.messages.map((m, i) => (
                <MessageItem
                  key={m.id}
                  message={m}
                  convId={conv.id}
                  onBranch={m.role === "user" && ready && !busy ? (text) => branchAndSend(conv.id, m.id, text) : undefined}
                  onRetry={i === conv.messages.length - 1 && !!m.error && ready && !busy ? retry : undefined}
                  onRegenerate={
                    i === conv.messages.length - 1 && m.role === "assistant" && !m.imageRequest && ready && !busy
                      ? regenerate
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>

        {hasMessages && !atBottom && (
          <button
            onClick={() => scrollToBottom("smooth")}
            aria-label="Scroll to latest"
            className="glass absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 animate-scale-in items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-ink shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)] transition hover:text-accent-soft active:scale-95"
          >
            {busy && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
            )}
            <ArrowDown size={14} />
            {busy ? "New reply" : "Latest"}
          </button>
        )}
      </div>

      <Composer
        key={conv.id}
        conversationId={conv.id}
        busy={busy}
        disabled={!ready}
        onSend={send}
        onStop={stop}
        onGenerateImage={generateImage}
        imageWarning={imageWarning}
      />
    </div>
  );
}

function Welcome({
  onPick,
  ready,
}: {
  onPick: (prompt: string) => void;
  ready: boolean;
}) {
  return (
    <section className="welcome-stage relative mx-auto flex w-full max-w-3xl flex-col px-5 py-10 sm:px-8 sm:py-16">
      <div className="mb-8 flex items-center gap-2 text-xs font-medium tracking-[0.08em] text-ink-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Your personal AI workspace
      </div>
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-accent-soft">
        <Sparkles size={23} strokeWidth={1.5} />
      </div>
      <h1 className="max-w-lg font-display text-4xl font-medium leading-[1.2] tracking-tight text-ink sm:text-5xl">
        A little curiosity.<br /><span className="text-gradient">Endless possibilities.</span>
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-muted sm:text-base">
        A space to think, write, and build. Bring your favorite models and make something yours.
      </p>
      {!ready && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-bg-panel p-4 sm:p-5">
          <div><p className="text-sm font-medium">Make your first connection</p>
            <p className="mt-1 text-xs text-ink-muted">Connect a provider, then choose a model in the top bar.</p></div>
          <button className="btn-primary text-xs" onClick={() => document.dispatchEvent(new CustomEvent("open-settings"))}>
            <Settings2 size={14} /> Connect a provider
          </button>
        </div>
      )}
      <div className="mb-3 mt-9 flex items-center justify-between">
        <h2 className="text-xs font-medium text-ink-muted">Start with a spark</h2>
        <span className="text-[11px] text-ink-faint">Pick a prompt. Make it yours.</span>
      </div>
      <div className="grid w-full gap-3 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button key={s.title} onClick={() => onPick(s.prompt)}
            className="group flex items-start gap-3 rounded-2xl border border-line/70 bg-bg-panel p-4 text-left transition duration-200 hover:border-accent/40 hover:bg-bg-elevated/30">
            <span className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-xl", TILE[s.tile])}><s.icon size={17} /></span>
            <span className="min-w-0 flex-1 pt-0.5"><span className="block text-sm font-medium text-ink">{s.title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-ink-muted">{s.desc}</span></span>
            <ArrowUpRight size={14} className="mt-1 shrink-0 text-ink-faint transition group-hover:text-accent-soft" />
          </button>
        ))}
      </div>
      <p className="mt-6 text-[11px] text-ink-faint">Your models. Your prompts. Your pace.</p>
    </section>
  );
}
