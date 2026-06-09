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
  const ready = !!provider && !!provider.apiKey && !!conv.model;

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
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent shadow-glow">
        <Sparkles size={28} className="text-white" />
      </div>
      <h1 className="text-2xl font-semibold">
        What can I help you build?
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        {ready
          ? "Pick a starting point or just start typing."
          : "Add a provider key and select a model in the top bar to begin."}
      </p>

      <div className="mt-8 grid w-full gap-3 sm:grid-cols-3">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.title}
            disabled={!ready}
            onClick={() => onPick(s.prompt)}
            className="card group flex flex-col items-start gap-2 p-4 text-left transition hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <s.icon size={18} className="text-accent-soft" />
            <span className="text-sm font-medium text-ink">{s.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
