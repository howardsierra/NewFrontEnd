"use client";

import { useEffect } from "react";
import { useStore } from "../store";
import { initSyncStatus, isSyncEnabled, syncNow } from "./engine";

const DEBOUNCE_MS = 3000;
const POLL_MS = 60_000;
const FOCUS_THROTTLE_MS = 10_000;

/**
 * Keep this device in sync: on load, shortly after local edits, when the tab
 * regains focus or the network returns, and every minute while visible.
 */
export function useAutoSync() {
  useEffect(() => {
    initSyncStatus();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastRun = 0;

    const run = () => {
      if (!isSyncEnabled()) return;
      // Wait for any reply in progress to finish before syncing that chat.
      const streaming = useStore
        .getState()
        .conversations.some((c) => c.messages.some((m) => m.streaming));
      if (streaming) {
        clearTimeout(timer);
        timer = setTimeout(run, DEBOUNCE_MS);
        return;
      }
      lastRun = Date.now();
      void syncNow();
    };

    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(run, DEBOUNCE_MS);
    };

    const soon = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRun < FOCUS_THROTTLE_MS) return;
      run();
    };

    run();

    const unsub = useStore.subscribe((s, prev) => {
      if (
        s.conversations !== prev.conversations ||
        s.providers !== prev.providers ||
        s.presets !== prev.presets ||
        s.snippets !== prev.snippets ||
        s.themes !== prev.themes ||
        s.regexScripts !== prev.regexScripts ||
        s.libraryFiles !== prev.libraryFiles ||
        s.personas !== prev.personas
      ) {
        schedule();
      }
    });

    const poll = setInterval(() => {
      if (document.visibilityState === "visible") run();
    }, POLL_MS);

    window.addEventListener("focus", soon);
    window.addEventListener("online", soon);
    document.addEventListener("visibilitychange", soon);
    return () => {
      unsub();
      clearTimeout(timer);
      clearInterval(poll);
      window.removeEventListener("focus", soon);
      window.removeEventListener("online", soon);
      document.removeEventListener("visibilitychange", soon);
    };
  }, []);
}
