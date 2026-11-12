"use client";

import { nanoid } from "nanoid";
import type { Attachment } from "./types";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20MB
export const MAX_TEXT_BYTES = 3 * 1024 * 1024;
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_PDF_PAGES = 200;

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

const IMAGE_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "heic", "heif", "avif", "tif", "tiff",
]);

function isImage(file: File): boolean {
  // Some browsers report HEIC/HEIF with an empty MIME type, so check the extension too.
  return file.type.startsWith("image/") || IMAGE_EXTENSIONS.has(ext(file.name));
}

/** Longest edge sent to models (Anthropic's recommended max; fine for OpenAI/Gemini). */
const MAX_IMAGE_EDGE = 1568;
/** Formats every provider accepts as-is. */
const SAFE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to <img> decoding */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("decode"));
      img.src = url;
    });
  } finally {
    // Safe: the <img> has already decoded (or failed) by now.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function hasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const data = ctx.getImageData(0, 0, w, h).data;
  for (let i = 3; i < data.length; i += 16) if (data[i] < 255) return true;
  return false;
}

/**
 * Downscale and re-encode an image so it is small (well under Vercel's 4.5 MB
 * request limit and browser storage quotas) and in a format every provider
 * accepts. Small images in a safe format are kept as-is so screenshots of text
 * stay crisp.
 */
async function prepareImage(file: File): Promise<{ dataUrl: string; mime: string }> {
  let img: ImageBitmap | HTMLImageElement;
  try {
    img = await decodeImage(file);
  } catch {
    const heic = /hei[cf]$/i.test(ext(file.name)) || /hei[cf]/i.test(file.type);
    throw new Error(
      heic
        ? `${file.name} is an iPhone HEIC photo this browser can't read. Share it as JPEG (or use Safari) and try again.`
        : `${file.name} couldn't be read as an image.`
    );
  }
  const width = "naturalWidth" in img ? img.naturalWidth : img.width;
  const height = "naturalHeight" in img ? img.naturalHeight : img.height;

  const safeType = SAFE_IMAGE_TYPES.has(file.type);
  if (safeType && file.size <= 1_000_000 && Math.max(width, height) <= MAX_IMAGE_EDGE) {
    if ("close" in img && typeof img.close === "function") img.close();
    return { dataUrl: await readAsDataUrl(file), mime: file.type };
  }

  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { dataUrl: await readAsDataUrl(file), mime: file.type || "image/png" };
  ctx.drawImage(img as CanvasImageSource, 0, 0, w, h);
  if ("close" in img && typeof img.close === "function") img.close();

  // Keep PNG for transparency or crisp screenshots, unless it ends up too big.
  if (file.type === "image/png" || hasTransparency(ctx, w, h)) {
    const png = canvas.toDataURL("image/png");
    if (png.length < 1_600_000 || hasTransparency(ctx, w, h)) {
      return { dataUrl: png, mime: "image/png" };
    }
  }
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.88), mime: "image/jpeg" };
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || ext(file.name) === "pdf";
}

function isTextLike(file: File): boolean {
  if (file.type.startsWith("text/")) return true;
  if (file.type === "application/json") return true;
  if (file.type.includes("javascript") || file.type.includes("xml")) return true;
  return TEXT_EXTENSIONS.has(ext(file.name)) || /^(dockerfile|makefile|license|readme)$/i.test(file.name);
}

function readAsText(file: File): Promise<string> {
  return file.text();
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
  // Copied from the installed PDF.js package by the install/dev/build scripts.
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  try {
    if (doc.numPages > MAX_PDF_PAGES) throw new Error("PDFs are limited to 200 pages. Split this document into smaller files.");
    const out: string[] = [];
    let totalBytes = 0;
    let hasText = false;
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((item: { str?: string }) => item.str ?? "").join(" ");
      hasText ||= !!text.trim();
      const section = `--- Page ${i} ---\n${text}`;
      totalBytes += new TextEncoder().encode(section).byteLength;
      if (totalBytes > MAX_TEXT_BYTES) throw new Error("This PDF contains too much text. Split it into smaller files (3 MB of extracted text maximum).");
      out.push(section);
      page.cleanup();
    }
    if (!hasText) throw new Error("This PDF has no selectable text. Use OCR to extract text from its scanned pages first.");
    return out.join("\n\n");
  } finally {
    await doc.destroy();
  }
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
    const { dataUrl, mime } = await prepareImage(file);
    return {
      ...base,
      mime,
      size: Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75),
      kind: "image",
      dataUrl,
    };
  }

  if (ext(file.name) === "docx") {
    if (file.size > MAX_PDF_BYTES) throw new Error(`${file.name} is too large (max 20MB for Word documents).`);
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    if (!result.value.trim()) throw new Error("This Word document contains no readable text.");
    if (new TextEncoder().encode(result.value).byteLength > MAX_TEXT_BYTES) throw new Error("This Word document contains too much text. Split it into smaller files.");
    return { ...base, kind: "text", text: result.value };
  }

  if (isPdf(file)) {
    if (file.size > MAX_PDF_BYTES) throw new Error(`${file.name} is too large (max 20MB for PDFs).`);
    const text = await extractPdfText(file);
    return { ...base, kind: "text", text };
  }

  // Apply the same limit before reading recognized text and unknown extensions.
  if (file.size > MAX_TEXT_BYTES) throw new Error(`${file.name} is too large (max 3MB for text).`);
  const text = await readAsText(file);
  const replacements = (text.match(/�/g) || []).length;
  if (text.includes("\0") || replacements > text.length * 0.05) {
    throw new Error(`Unsupported binary file: ${file.name}. Attach text, source code, a PDF, or an image.`);
  }
  if (!isTextLike(file) && !text.trim()) throw new Error(`No readable text in ${file.name}.`);
  return { ...base, kind: "text", text };
}

/** Render a text attachment into a fenced block for the prompt. */
export function attachmentToPrompt(a: Attachment): string {
  if (a.kind !== "text" || !a.text) return "";
  const lang = ext(a.name).replace(/[^a-z0-9_-]/g, "") || "text";
  let longest = 0;
  for (const match of a.text.matchAll(/`+/g)) longest = Math.max(longest, match[0].length);
  const fence = "`".repeat(Math.max(3, longest + 1));
  const name = a.name.replace(/[\r\n`]/g, " ");
  return `\n\n**Attached file: \`${name}\`**\n${fence}${lang}\n${a.text}\n${fence}`;
}
