"use client";

import { useStore } from "@/lib/store";
import { generatedFileId, makeLibraryFile, type FileOrigin } from "@/lib/file-library";
import { ZipDownload } from "./ZipDownload";
import { GeneratedFile } from "./GeneratedFile";
import { splitGeneratedFiles } from "@/lib/generated-files";
import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { downloadCode } from "@/lib/code-files";
import { Check, Copy, Download, WrapText } from "lucide-react";

function CodeBlock({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const [wrap, setWrap] = useState(false);
  const [copyError, setCopyError] = useState(false);

  // Extract the language from the child <code class="language-xxx">.
  const codeEl: any = Array.isArray(children) ? children[0] : children;
  const cls: string = codeEl?.props?.className || "";
  const lang = /language-([\w-]+)/.exec(cls)?.[1] || "code";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(extractText(children));
      setCopyError(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopyError(true);
    }
  };

  return (
    <div className="code-block group">
      <div className="code-head">
        <span className="font-mono uppercase tracking-wide">{lang}</span>
        <div className="ml-auto flex items-center gap-2">
          <button aria-label="Toggle code wrapping" aria-pressed={wrap} className="rounded p-1 text-ink-muted hover:text-ink" title="Wrap long lines" onClick={() => setWrap(!wrap)}><WrapText size={14} /></button>
          <button aria-label="Download code" title="Download code" className="rounded p-1 text-ink-muted hover:text-ink" onClick={() => downloadCode(extractText(children), lang)}><Download size={14} /></button>
        <button
          onClick={copy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-ink-faint transition hover:bg-white/10 hover:text-ink"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check size={12} className="text-green-400" /> Copied
            </>
          ) : (
            <>
              <Copy size={12} /> Copy
            </>
          )}
        </button>
        </div>
      </div>
      {copyError && <p role="status" className="px-3 py-1 text-xs text-ink-muted">Copy is unavailable. Select the text or download the code instead.</p>}
      <pre style={wrap ? { whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" } : undefined}>{children}</pre>
    </div>
  );
}

function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in (node as any)) {
    return extractText((node as any).props.children);
  }
  return "";
}

export const Markdown = memo(function Markdown({ content, origin, createdAt = 0, pending = false, fileRevision }: { content: string; origin?: FileOrigin; createdAt?: number; pending?: boolean; fileRevision?: { fileId: string; partIndex: number } }) {
  const kept = useStore((state) => state.libraryFiles);
  const parts = splitGeneratedFiles(content);
  const fileId = (index: number, filename: string) => fileRevision?.partIndex === index ? fileRevision.fileId : origin ? generatedFileId(origin.conversationId, origin.messageId, index) : `reply:${index}:${filename}`;
  const records = parts.flatMap((part, index) => part.kind === "file" ? [makeLibraryFile(fileId(index, part.filename), part.filename, part.content, createdAt, origin, part.path)] : []);
  const versions = records.map((file) => (kept.find((item) => item.id === file.id) ?? file).versions).map((items) => items[items.length - 1]);
  return (
    <div className="prose-chat">
      {!pending && versions.length > 1 && <ZipDownload files={versions} />}
      {parts.map((part, index) => part.kind === "file" ? (
        <GeneratedFile key={`${index}:${part.filename}`} filename={part.filename} content={part.content} pending={pending} record={records.find((file) => file.id === (fileId(index, part.filename)))} />
      ) : <ReactMarkdown
        key={index}
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {part.content}
      </ReactMarkdown>)}
    </div>
  );
});
