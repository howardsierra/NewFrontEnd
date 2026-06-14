"use client";

import { useEffect, useRef } from "react";
import type { Conversation } from "@/lib/types";
import { MessageItem } from "./MessageItem";
import { Composer } from "./Composer";
import { ModelBar } from "./ModelBar";
import { useChat } from "@/lib/useChat";
import { useStore } from "@/lib/store";
import { Sparkles, FileText, Code2, Wand2 } from "lucide-react";

const SUGGESTIONS = [
  {
    icon: Wand2,
    title: "Draft a SillyTavern preset",
    prompt:
      "Help me build a SillyTavern preset. Ask me about the persona, tone, and formatting rules, then output the system prompt and recommended sampler settings.",
  },
  {
    icon: Code2,
    title: "Review attached code",
    prompt:
      "I'll attach some HTML/CSS/JS files. Review them for bugs, accessibility, and performance, then suggest concrete fixes.",
  },
  {
    icon: FileText,
    title: "Summarize a PDF",
    prompt:
      "I'll attach a PDF. Give me a tight executive summary with the key points and any action items.",
  },
];

export function ChatView({ conv }: { conv: Conversation }) {
  const { send, stop, regenerate, busy } = useChat();
  const providers = useStore((s) => s.providers);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const provider = providers.find((p) => p.id === conv.providerId);
  const providerReady = !!provider && (
    provider.kind === "custom" ? !!provider.baseUrl : !!provider.apiKey
  );
  const ready = providerReady && !!conv.model;

  // Auto-scroll to bottom as content streams in.
  const lastContent =
    conv.messages[conv.messages.length - 1]?.content.length ?? 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conv.messages.length, lastContent]);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <ModelBar
        conv={conv}
        onToggleSidebar={() =>
          document.dispatchEvent(new CustomEvent("toggle-sidebar"))
        }
      />

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {conv.messages.length === 0 ? (
          <Welcome
            onPick={(p) => send(p, [])}
            ready={ready}
          />
        ) : (
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
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
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <Composer busy={busy} disabled={!ready} onSend={send} onStop={stop} />
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
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-16 text-center">
      <div className="relative mb-5">
        <div className="absolute inset-0 -z-10 animate-glow-pulse rounded-[28px] bg-accent/40 blur-2xl" />
        <div className="grid h-16 w-16 place-items-center rounded-[20px] bg-accent-grad shadow-glow ring-1 ring-white/15">
          <Sparkles size={30} className="text-white" />
        </div>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-gradient">
        What can I help you build?
      </h1>
      <p className="mt-2.5 text-sm text-ink-muted">
        {ready
          ? "Pick a starting point or just start typing."
          : "Add a provider key and select a model in the top bar to begin."}
      </p>

      <div className="mt-9 grid w-full gap-3 sm:grid-cols-3">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.title}
            disabled={!ready}
            onClick={() => onPick(s.prompt)}
            className="group relative flex flex-col items-start gap-2.5 overflow-hidden rounded-2xl border border-line/80 bg-white/[0.02] p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-white/[0.04] hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-grad-soft text-accent-soft ring-1 ring-white/5 transition-transform group-hover:scale-105">
              <s.icon size={18} />
            </span>
            <span className="text-sm font-medium text-ink">{s.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
