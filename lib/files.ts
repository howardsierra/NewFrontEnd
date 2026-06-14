"use client";

import { nanoid } from "nanoid";
import type { Attachment } from "./types";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_TEXT_BYTES = 5 * 1024 * 1024; // 5MB

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "html", "htm", "css", "scss", "less",
  "js", "jsx", "ts", "tsx", "mjs", "cjs", "json", "jsonc", "json5",
  "xml", "yaml", "yml", "toml", "ini", "csv", "tsv", "py", "rb", "go",
  "rs", "java", "kt", "c", "h", "cpp", "hpp", "cs", "php", "sh", "bash",
  "sql", "swift", "vue", "svelte", "log", "env", "gitignore", "dockerfile",
]);

function ext(name: string): string {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop()! : "";
}

function isImage(file: File): boolean {
  return file.type.startsWith("image/");
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || ext(file.name) === "pdf";
}

function isTextLike(file: File): boolean {
  if (file.type.startsWith("text/")) return true;
  if (file.type === "application/json") return true;
  if (file.type.includes("javascript") || file.type.includes("xml")) return true;
  return TEXT_EXTENSIONS.has(ext(file.name));
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it: any) => it.str).join(" ");
    out.push(`--- Page ${i} ---\n${text}`);
  }
  return out.join("\n\n");
}

export async function parseFile(file: File): Promise<Attachment> {
  const base = {
    id: nanoid(),
    name: file.name,
    mime: file.type || "application/octet-stream",
    size: file.size,
  };

  if (isImage(file)) {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error(`${file.name} is too large (max 20MB for images).`);
    }
    const dataUrl = await readAsDataUrl(file);
    return { ...base, kind: "image", dataUrl };
  }

  if (isPdf(file)) {
    const text = await extractPdfText(file);
    return { ...base, kind: "text", text };
  }

  if (isTextLike(file)) {
    if (file.size > MAX_TEXT_BYTES) {
      throw new Error(`${file.name} is too large (max 5MB for text).`);
    }
    const text = await readAsText(file);
    return { ...base, kind: "text", text };
  }

  // Unknown binary: attempt a best-effort text read, else reject.
  try {
    const text = await readAsText(file);
    // Heuristic: reject if it looks binary (many null/replacement chars).
    const bad = (text.match(/�/g) || []).length;
    if (bad > text.length * 0.05) {
      throw new Error("binary");
    }
    return { ...base, kind: "text", text };
  } catch {
    throw new Error(`Unsupported file type: ${file.name}`);
  }
}

/** Render a text attachment into a fenced block for the prompt. */
export function attachmentToPrompt(a: Attachment): string {
  if (a.kind !== "text" || !a.text) return "";
  const lang = ext(a.name) || "";
  return `\n\n**Attached file: \`${a.name}\`**\n\`\`\`${lang}\n${a.text}\n\`\`\``;
}
