"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { STORAGE_EVENT, StorageNotice } from "@/lib/safeStorage";
import { Sidebar } from "@/components/Sidebar";
import { ChatView } from "@/components/ChatView";
import { SettingsModal } from "@/components/SettingsModal";
import { PresetBuilder } from "@/components/PresetBuilder";
import { SnippetLibrary } from "@/components/SnippetLibrary";
import { BackupModal } from "@/components/BackupModal";
import { ThemeBuilder } from "@/components/ThemeBuilder";
import { RegexBuilder } from "@/components/RegexBuilder";
import { PersonaBuilder } from "@/components/PersonaBuilder";
import { SyncModal } from "@/components/SyncModal";
import { useAutoSync } from "@/lib/sync/useAutoSync";
import { isSyncEnabled } from "@/lib/sync/engine";
import { Sparkles } from "lucide-react";
import clsx from "clsx";

export default function Page() {
  const conversations = useStore((s) => s.conversations);
  const activeId = useStore((s) => s.activeId);
  const newConversation = useStore((s) => s.newConversation);
  const setActive = useStore((s) => s.setActive);
  const providers = useStore((s) => s.providers);

  // Client-only gate. Renders the loading state on the server and on the first
  // client render (so hydration matches), then flips true after mount — by
  // which point zustand's synchronous localStorage rehydration has run.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Apply the chosen UI theme to the document root.
  const uiTheme = useStore((s) => s.uiTheme);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", uiTheme);
  }, [uiTheme]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [snippetsOpen, setSnippetsOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [themesOpen, setThemesOpen] = useState(false);
  const [regexOpen, setRegexOpen] = useState(false);
  const [personasOpen, setPersonasOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useAutoSync();

  // Ensure there's always an active conversation once mounted.
  useEffect(() => {
    if (!mounted) return;
    if (conversations.length === 0) {
      newConversation();
    } else if (!activeId || !conversations.some((c) => c.id === activeId)) {
      setActive(conversations[0].id);
    }
    // Open settings automatically on first run when no providers exist.
    if (providers.length === 0) setSettingsOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // Mobile sidebar toggle via custom event from the model bar.
  useEffect(() => {
    const handler = () => setSidebarOpen((v) => !v);
    document.addEventListener("toggle-sidebar", handler);
    return () => document.removeEventListener("toggle-sidebar", handler);
  }, []);

  // Open the snippet library from the composer button.
  useEffect(() => {
    const handler = () => setSnippetsOpen(true);
    document.addEventListener("open-snippets", handler);
    return () => document.removeEventListener("open-snippets", handler);
  }, []);

  // Open the persona manager from the header pill.
  useEffect(() => {
    const handler = () => setPersonasOpen(true);
    document.addEventListener("open-personas", handler);
    return () => document.removeEventListener("open-personas", handler);
  }, []);

  // Surface browser-storage problems instead of failing silently.
  const [storageNotice, setStorageNotice] = useState<StorageNotice | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const handler = (e: Event) => {
      setStorageNotice((e as CustomEvent<StorageNotice>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setStorageNotice(null), 9000);
    };
    window.addEventListener(STORAGE_EVENT, handler);
    return () => {
      window.removeEventListener(STORAGE_EVENT, handler);
      clearTimeout(timer);
    };
  }, []);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  if (!mounted) {
    return (
      <div className="grid h-dvh place-items-center">
        <div className="flex items-center gap-2 text-ink-muted">
          <Sparkles size={18} className="animate-pulse text-accent-soft" />
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenPresets={() => setPresetsOpen(true)}
          onOpenSnippets={() => setSnippetsOpen(true)}
          onOpenThemes={() => setThemesOpen(true)}
          onOpenRegex={() => setRegexOpen(true)}
          onOpenPersonas={() => setPersonasOpen(true)}
          onOpenBackup={() => setBackupOpen(true)}
          onOpenSync={() => setSyncOpen(true)}
        />
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
            onOpenPresets={() => setPresetsOpen(true)}
            onOpenSnippets={() => setSnippetsOpen(true)}
            onOpenThemes={() => setThemesOpen(true)}
            onOpenRegex={() => setRegexOpen(true)}
            onOpenPersonas={() => setPersonasOpen(true)}
            onOpenBackup={() => setBackupOpen(true)}
            onOpenSync={() => setSyncOpen(true)}
            onClose={() => setSidebarOpen(false)}
          />
        </div>
      </div>

      {/* Main */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        {active ? (
          <ChatView conv={active} />
        ) : (
          <div className="grid flex-1 place-items-center text-ink-muted">
            No conversation selected.
          </div>
        )}
      </main>

      {storageNotice && (
        <div
          role="status"
          className="glass fixed left-1/2 top-3 z-[60] flex w-[min(92vw,34rem)] -translate-x-1/2 animate-scale-in items-start gap-3 rounded-xl px-4 py-3 text-sm text-ink shadow-2xl"
        >
          <span className="flex-1">
            {storageNotice === "pruned"
              ? isSyncEnabled()
                ? "Browser storage is full, so older images aren't kept on this device. They're safe in your synced vault and load again when you open the chat."
                : "Browser storage was full, so older images were removed from your saved chat history. Your keys and settings are saved."
              : "Couldn't save to browser storage. Export a copy from Backup & restore so nothing is lost."}
          </span>
          <button
            className="text-ink-faint hover:text-ink"
            onClick={() => setStorageNotice(null)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {presetsOpen && <PresetBuilder onClose={() => setPresetsOpen(false)} />}
      {snippetsOpen && <SnippetLibrary onClose={() => setSnippetsOpen(false)} />}
      {themesOpen && <ThemeBuilder onClose={() => setThemesOpen(false)} />}
      {regexOpen && <RegexBuilder onClose={() => setRegexOpen(false)} />}
      {personasOpen && <PersonaBuilder onClose={() => setPersonasOpen(false)} />}
      {backupOpen && <BackupModal onClose={() => setBackupOpen(false)} />}
      {syncOpen && <SyncModal onClose={() => setSyncOpen(false)} />}
    </div>
  );
}
