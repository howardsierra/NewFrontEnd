"use client";
import { useMemo } from "react";
import hljs from "highlight.js/lib/common";

const aliases: Record<string, string> = { tsx: "typescript", ts: "typescript", jsx: "javascript", js: "javascript", html: "xml", htm: "xml", svg: "xml", sh: "bash", py: "python", rb: "ruby", rs: "rust", cs: "csharp", md: "markdown" };

export function CodePreview({ content, filename }: { content: string; filename: string }) {
  const preview = content.slice(0, 12000);
  const language = filename.split(".").pop()?.toLowerCase() || "plaintext";

  const highlighted = useMemo(() => hljs.highlight(preview, { language: hljs.getLanguage(aliases[language] ?? language) ? aliases[language] ?? language : "plaintext", ignoreIllegals: true }).value, [preview, language]);
  return <div>
    <div className="code-preview flex max-h-80 overflow-auto rounded-xl border font-mono text-[13px]" aria-label="Code preview">
      <div aria-hidden="true" className="code-line-numbers shrink-0 select-none border-r px-3 py-4 text-right">{preview.split("\n").map((_, index) => <div key={index}>{index + 1}</div>)}</div>
      <pre className="min-w-0 flex-1 p-4"><code className="hljs" dangerouslySetInnerHTML={{ __html: highlighted }} /></pre>
    </div>
    {content.length > 12000 && <p className="mt-2 text-xs text-ink-muted">Showing the first 12,000 characters. The full file is used for downloads.</p>}
  </div>;
}
