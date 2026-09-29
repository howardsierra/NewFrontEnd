"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Conversation } from "@/lib/types";
import { MessageItem } from "./MessageItem";
import { Composer } from "./Composer";
import { ModelBar } from "./ModelBar";
import { useChat } from "@/lib/useChat";
import { useStore } from "@/lib/store";
import clsx from "clsx";
import { FileText, Code2, Wand2, Lightbulb, ChevronRight, ArrowDown } from "lucide-react";

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
  peach: "bg-[#f9eae0] text-[#cc7548]",
  blue: "bg-[#e4eef9] text-[#4c83b8]",
  violet: "bg-[#eee8fa] text-[#8061ba]",
  green: "bg-[#e4f2e8] text-[#56966b]",
};

export function ChatView({ conv }: { conv: Conversation }) {
  const { send, stop, regenerate, generateImage, busy } = useChat();
  const providers = useStore((s) => s.providers);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Follow the stream only while the reader is at (or near) the bottom.
  const stickRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  const provider = providers.find((p) => p.id === conv.providerId);
  const providerReady = !!provider && (
    provider.kind === "custom" ? !!provider.baseUrl : !!provider.apiKey
  );
  const ready = providerReady && !!conv.model;

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

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain"
        >
          {!hasMessages ? (
            <Welcome
              onPick={(p) => send(p, [])}
              ready={ready}
            />
          ) : (
            <div className="mx-auto max-w-3xl space-y-6 px-3 py-6 sm:space-y-8 sm:px-4 sm:py-8">
              {conv.messages.map((m, i) => (
                <MessageItem
                  key={m.id}
                  message={m}
                  convId={conv.id}
                  onRegenerate={
                    i === conv.messages.length - 1 && m.role === "assistant" && !busy
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

      <Composer busy={busy} disabled={!ready} onSend={send} onStop={stop} onGenerateImage={generateImage} />
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
    <div className="relative mx-auto flex max-w-2xl flex-col items-center px-4 py-10 text-center sm:py-16">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 overflow-hidden">
        <span
          className="aurora-blob left-[18%] top-2 h-40 w-40"
          style={{ background: "rgb(var(--c-accent) / 0.55)", animation: "aurora-a 9s ease-in-out infinite" }}
        />
        <span
          className="aurora-blob right-[16%] top-10 h-44 w-44"
          style={{ background: "rgb(var(--c-accent-glow) / 0.5)", animation: "aurora-b 11s ease-in-out infinite" }}
        />
      </div>
      <div className="relative mb-6">
        <div className="absolute inset-0 -z-10 animate-glow-pulse rounded-[24px] bg-accent/40 blur-2xl" />
        <div
          className="h-[64px] w-[64px] rounded-[20px] ring-1 ring-white/20"
          style={{
            background:
              "radial-gradient(circle at 34% 27%, #fff 0 3%, #d8b9f8 13%, #926ede 39%, #4f3e9a 73%, #2d275c 100%)",
            transform: "rotate(-9deg)",
            boxShadow: "inset -8px -9px 15px rgba(49,38,81,0.53), 0 8px 22px rgba(136,117,198,0.28)",
          }}
        />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-gradient sm:text-3xl">
        What can I help you create?
      </h1>
      <p className="mt-2.5 text-sm text-ink-muted">
        {ready
          ? "Choose a starting point or ask me anything."
          : "Add a provider key and select a model in the top bar to begin."}
      </p>

      <div className="mt-9 grid w-full gap-3 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.title}
            disabled={!ready}
            onClick={() => onPick(s.prompt)}
            className="group flex items-center gap-3 rounded-2xl border border-line/80 bg-overlay/[0.02] p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-overlay/[0.05] hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <span className={clsx("grid h-10 w-10 shrink-0 place-items-center rounded-xl", TILE[s.tile])}>
              <s.icon size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">{s.title}</span>
              <span className="block truncate text-xs text-ink-faint">{s.desc}</span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-ink-faint opacity-0 transition group-hover:opacity-100" />
          </button>
        ))}
      </div>
    </div>
  );
}
