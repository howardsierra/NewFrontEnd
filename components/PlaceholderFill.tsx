"use client";

import { useEffect, useRef, useState } from "react";
import { fillPlaceholders } from "@/lib/placeholders";
import { Braces, CornerDownLeft, X } from "lucide-react";

export function PlaceholderFill({
  body,
  variables,
  onSubmit,
  onCancel,
}: {
  body: string;
  variables: string[];
  onSubmit: (filled: string) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  const preview = fillPlaceholders(body, values);
  const submit = () => onSubmit(fillPlaceholders(body, values));

  return (
    <div className="absolute bottom-full left-2 right-2 mb-2 overflow-hidden rounded-xl border border-line bg-bg-panel shadow-panel animate-scale-in">
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2 text-[11px] text-ink-faint">
        <Braces size={12} className="text-accent-soft" />
        Fill in {variables.length} placeholder{variables.length > 1 ? "s" : ""}
        <span className="text-ink-faint/70">· Tab to move · ⏎ to insert · Esc to cancel</span>
        <button
          className="ml-auto text-ink-faint hover:text-ink"
          onClick={onCancel}
          aria-label="Cancel"
        >
          <X size={13} />
        </button>
      </div>

      <div className="max-h-44 space-y-2 overflow-y-auto p-3">
        {variables.map((name, i) => (
          <div key={name} className="flex items-center gap-2">
            <label className="w-28 shrink-0 truncate font-mono text-xs text-accent-soft" title={name}>
              {name}
            </label>
            <input
              ref={i === 0 ? firstRef : undefined}
              value={values[name] ?? ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, [name]: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  onCancel();
                }
              }}
              placeholder={`Value for ${name}…`}
              className="input py-1.5 text-sm"
            />
          </div>
        ))}
      </div>

      <div className="border-t border-line bg-overlay/[0.02] px-3 py-2">
        <p className="mb-2 line-clamp-3 whitespace-pre-wrap text-[12px] leading-relaxed text-ink-muted">
          {preview}
        </p>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost text-xs" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-primary text-xs" onClick={submit}>
            <CornerDownLeft size={13} /> Insert
          </button>
        </div>
      </div>
    </div>
  );
}
