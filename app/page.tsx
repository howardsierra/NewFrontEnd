"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Sidebar } from "@/components/Sidebar";
import { ChatView } from "@/components/ChatView";
import { SettingsModal } from "@/components/SettingsModal";
import { Sparkles } from "lucide-react";
import clsx from "clsx";

export default function Page() {
  const hydrated = useStore((s) => s.hydrated);
  const conversations = useStore((s) => s.conversations);
  const activeId = useStore((s) => s.activeId);
  const newConversation = useStore((s) => s.newConversation);
  const setActive = useStore((s) => s.setActive);
  const providers = useStore((s) => s.providers);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Ensure there's always an active conversation once hydrated.
  useEffect(() => {
    if (!hydrated) return;
    if (conversations.length === 0) {
      newConversation();
    } else if (!activeId || !conversations.some((c) => c.id === activeId)) {
      setActive(conversations[0].id);
    }
    // Open settings automatically on first run when no providers exist.
    if (providers.length === 0) setSettingsOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Mobile sidebar toggle via custom event from the model bar.
  useEffect(() => {
    const handler = () => setSidebarOpen((v) => !v);
    document.addEventListener("toggle-sidebar", handler);
    return () => document.removeEventListener("toggle-sidebar", handler);
  }, []);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  if (!hydrated) {
    return (
      <div className="grid h-screen place-items-center">
        <div className="flex items-center gap-2 text-ink-muted">
          <Sparkles size={18} className="animate-pulse text-accent-soft" />
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
      </div>

      {/* Mobile sidebar drawer */}
      <div
        className={clsx(
          "fixed inset-0 z-40 lg:hidden",
          sidebarOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        <div
          className={clsx(
            "absolute inset-0 bg-black/50 transition-opacity",
            sidebarOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setSidebarOpen(false)}
        />
        <div
          className={clsx(
            "absolute left-0 top-0 h-full transition-transform",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <Sidebar
            onOpenSettings={() => {
              setSettingsOpen(true);
              setSidebarOpen(false);
            }}
            onClose={() => setSidebarOpen(false)}
          />
        </div>
      </div>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        {active ? (
          <ChatView conv={active} />
        ) : (
          <div className="grid flex-1 place-items-center text-ink-muted">
            No conversation selected.
          </div>
        )}
      </main>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
