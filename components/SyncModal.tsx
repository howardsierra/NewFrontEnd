"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import {
  deleteRemoteVault,
  disableSync,
  enableSync,
  isServerConfigured,
  probeVault,
  syncNow,
  useSyncStatus,
} from "@/lib/sync/engine";
import { generatePassphrase, normalizePassphrase } from "@/lib/sync/crypto";
import {
  X,
  Cloud,
  CloudOff,
  RefreshCw,
  Eye,
  EyeOff,
  Dices,
  Copy,
  Check,
  Lock,
  ShieldAlert,
  AlertTriangle,
  Loader2,
  Trash2,
  LogOut,
} from "lucide-react";
import clsx from "clsx";

const MIN_LENGTH = 12;

export function timeAgo(t?: number): string {
  if (!t) return "never";
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(t).toLocaleDateString();
}

export function SyncModal({ onClose }: { onClose: () => void }) {
  const status = useSyncStatus();
  const enabled = status.phase !== "off";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:p-8">
      <div className="card w-full max-w-lg animate-fade-in shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <Cloud size={18} className="text-accent-soft" />
            <h2 className="text-base font-semibold">Sync across devices</h2>
          </div>
          <button className="btn-ghost px-2" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{enabled ? <Enabled /> : <Setup />}</div>
      </div>
    </div>
  );
}

function Setup() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the passphrase didn't match any existing vault.
  const [pending, setPending] = useState<Awaited<ReturnType<typeof probeVault>>["keys"] | null>(null);

  useEffect(() => {
    isServerConfigured().then(setConfigured);
  }, []);

  const tooShort = normalizePassphrase(pass).length < MIN_LENGTH;

  const start = async () => {
    setError(null);
    setBusy(true);
    try {
      const { keys, exists } = await probeVault(pass);
      if (exists) await enableSync(keys);
      else setPending(keys);
    } catch (e: any) {
      setError(e?.message || "Couldn't reach sync storage.");
    } finally {
      setBusy(false);
    }
  };

  const createNew = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await enableSync(pending);
    } catch (e: any) {
      setError(e?.message || "Couldn't turn on sync.");
    } finally {
      setBusy(false);
    }
  };

  if (pending) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-line bg-bg-subtle/60 p-4">
          <Cloud size={20} className="mt-0.5 shrink-0 text-accent-soft" />
          <div className="text-sm">
            <p className="font-medium text-ink">No synced data uses this passphrase yet.</p>
            <p className="mt-1 text-ink-muted">
              If this is your first device, start a new vault. If you already set up
              sync elsewhere, go back and check the passphrase — a typo creates a
              separate, empty vault.
            </p>
          </div>
        </div>
        {error && <ErrorBox message={error} />}
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary text-sm" onClick={createNew} disabled={busy}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Cloud size={15} />}
            Start a new vault
          </button>
          <button className="btn-soft text-sm" onClick={() => setPending(null)} disabled={busy}>
            Re-check passphrase
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        Keep your chats, images, providers and API keys, personas, presets, and
        snippets the same on every device. Enter the same passphrase on each one.
      </p>

      <div className="flex items-start gap-2.5 rounded-xl border border-accent/25 bg-accent/[0.07] px-3.5 py-3 text-xs text-ink-muted">
        <Lock size={15} className="mt-0.5 shrink-0 text-accent-soft" />
        <p>
          <span className="font-medium text-ink">End-to-end encrypted.</span> Everything
          is encrypted in this browser with your passphrase before it's uploaded. The
          server only stores scrambled data and never sees the passphrase.
        </p>
      </div>

      {configured === false && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <p>
            Sync storage isn't connected to this deployment yet. In Vercel, create a
            private Blob store and connect it to this project, then redeploy.
          </p>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-xs font-medium text-ink-muted">Sync passphrase</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={show ? "text" : "password"}
              value={pass}
              onChange={(e) => {
                setPass(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !tooShort && saved && !busy) start();
              }}
              placeholder={`At least ${MIN_LENGTH} characters`}
              autoComplete="off"
              spellCheck={false}
              className="input pr-10 font-mono"
            />
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide passphrase" : "Show passphrase"}
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <button
            className="btn-soft px-3"
            title="Generate a strong passphrase"
            onClick={() => {
              setPass(generatePassphrase());
              setShow(true);
            }}
          >
            <Dices size={16} />
          </button>
          <button
            className="btn-soft px-3"
            title="Copy"
            disabled={!pass}
            onClick={() =>
              navigator.clipboard.writeText(pass).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              })
            }
          >
            {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
          </button>
        </div>
        {pass && tooShort && (
          <p className="mt-1.5 text-[11px] text-ink-faint">
            Use at least {MIN_LENGTH} characters, or tap the dice for a strong one.
          </p>
        )}
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200/90">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className="mt-0.5 accent-accent"
        />
        <span className="flex gap-1.5">
          <ShieldAlert size={15} className="shrink-0" />
          I've saved this passphrase somewhere safe. It can't be reset or recovered —
          without it, synced data can't be decrypted.
        </span>
      </label>

      {error && <ErrorBox message={error} />}

      <button
        className="btn-primary w-full text-sm"
        disabled={tooShort || !saved || busy || configured === false}
        onClick={start}
      >
        {busy ? (
          <>
            <Loader2 size={15} className="animate-spin" /> Unlocking…
          </>
        ) : (
          <>
            <Cloud size={15} /> Turn on sync
          </>
        )}
      </button>
    </div>
  );
}

function Enabled() {
  const status = useSyncStatus();
  const conversations = useStore((s) => s.conversations);
  const providers = useStore((s) => s.providers);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, tick] = useState(0);

  // Keep the "synced 2m ago" label fresh.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const syncing = status.phase === "syncing";
  const chatCount = conversations.filter((c) => c.messages.length > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border border-line bg-bg-subtle/60 p-4">
        <span
          className={clsx(
            "grid h-10 w-10 shrink-0 place-items-center rounded-full",
            status.phase === "error" ? "bg-red-500/15 text-red-300" : "bg-accent/15 text-accent-soft"
          )}
        >
          {status.phase === "error" ? (
            <CloudOff size={19} />
          ) : (
            <Cloud size={19} className={clsx(syncing && "animate-pulse")} />
          )}
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium text-ink">
            {syncing
              ? "Syncing…"
              : status.phase === "error"
                ? "Sync paused"
                : "Sync is on"}
          </p>
          <p className="text-xs text-ink-faint">
            Last synced {timeAgo(status.lastSync)} · {chatCount} chats · {providers.length} providers
          </p>
        </div>
        <button
          className="btn-soft text-sm"
          disabled={syncing}
          onClick={() => syncNow()}
        >
          <RefreshCw size={15} className={clsx(syncing && "animate-spin")} />
          Sync now
        </button>
      </div>

      {status.phase === "error" && status.error && <ErrorBox message={status.error} />}

      <p className="text-xs text-ink-muted">
        Changes sync automatically a few seconds after you make them, and whenever
        you come back to this tab. To add another device, open Flux.AI there and
        enter the same passphrase.
      </p>

      <div className="h-px bg-line" />

      <div className="space-y-2">
        <button
          className="btn-ghost w-full justify-start text-sm"
          onClick={() => disableSync()}
        >
          <LogOut size={15} />
          Turn off sync on this device
          <span className="ml-auto text-[11px] text-ink-faint">keeps local data</span>
        </button>

        {!confirmDelete ? (
          <button
            className="btn-ghost w-full justify-start text-sm text-red-300 hover:text-red-200"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={15} />
            Delete synced data from the server
          </button>
        ) : (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200/90">
            <p>
              This permanently removes the encrypted copy from the server and turns
              sync off here. Data on each device stays, but other devices will stop
              syncing. Continue?
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                className="btn-soft text-xs text-red-200"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  setError(null);
                  try {
                    await deleteRemoteVault();
                  } catch (e: any) {
                    setError(e?.message || "Couldn't delete server data.");
                  } finally {
                    setDeleting(false);
                    setConfirmDelete(false);
                  }
                }}
              >
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Delete it
              </button>
              <button className="btn-ghost text-xs" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {error && <ErrorBox message={error} />}
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
