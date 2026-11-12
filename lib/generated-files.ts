import { exportFilename } from "./download";

export const FILE_CREATION_INSTRUCTIONS = `File creation: When the user asks you to CREATE a downloadable file, provide its complete contents in a fenced code block with filename metadata, for example:
\`\`\`markdown filename="report.pdf"
# Report
Document content here.
\`\`\`
The app creates PDF and DOCX files from Markdown in these blocks. For text, code, CSV, JSON, or HTML files, use the appropriate language and filename (example: json filename="data.json") and include the exact file contents. Use separate blocks for separate files. For projects, use relative filenames like src/app.ts so ZIP downloads preserve folders. Never use absolute paths or parent-directory paths. Use a longer outer fence if the content contains code fences. When revising an attached file, return its complete updated contents in a named file block rather than a partial patch. Never put base64, binary data, or pretend download links in these blocks. Do not claim a file was saved to disk. For unsupported binary formats, explain the limitation and offer PDF, DOCX, or a text-based format. Use ordinary code fences without filename metadata when the user only wants code explained.`;

export type ReplyPart = { kind: "text"; content: string } | { kind: "file"; content: string; filename: string; language: string; path?: string };
export function splitGeneratedFiles(reply: string): ReplyPart[] {
  const parts: ReplyPart[] = [];
  const blocks = /^(`{3,}|~{3,})([^\r\n]*)\r?\n([\s\S]*?)\r?\n\1[ \t]*(?=\r?\n|$)/gm;
  let last = 0;
  for (const match of reply.matchAll(blocks)) {
    const metadata = /(?:^|\s)filename=(?:"([^"\r\n]+)"|'([^'\r\n]+)'|([^\s]+))/.exec(match[2]);
    if (!metadata) continue;
    if (match.index! > last) parts.push({ kind: "text", content: reply.slice(last, match.index) });
    const name = metadata[1] || metadata[2] || metadata[3];
    const extension = /\.([a-z0-9]+)$/i.exec(name)?.[1] || "txt";
    const path = safeProjectPath(name);
    const filename = path?.split("/").pop() || exportFilename(name, extension, "document");
    parts.push({ kind: "file", filename, ...(path && path.includes("/") ? { path } : {}), language: match[2].trim().split(/\s/)[0], content: match[3] });
    last = match.index! + match[0].length;
  }
  if (last < reply.length || !parts.length) parts.push({ kind: "text", content: reply.slice(last) });
  return parts;
}

const TEXT_FORMATS = new Set(["txt", "md", "markdown", "csv", "tsv", "json", "jsonl", "html", "htm", "css", "scss", "js", "jsx", "ts", "tsx", "mjs", "cjs", "py", "rb", "go", "rs", "java", "kt", "swift", "sh", "sql", "c", "h", "cpp", "hpp", "cs", "xml", "yaml", "yml", "toml", "ini", "vue", "svelte", "tex", "svg", "env", "gitignore", "npmrc", "editorconfig"]);
export function generatedFileFormat(filename: string): string {
  if (!filename.includes(".")) return "txt";
  const extension = filename.split(".").pop()!.toLowerCase();
  if (extension === "pdf" || extension === "docx" || TEXT_FORMATS.has(extension)) return extension;
  throw new Error("This format cannot be created here yet. Ask for a PDF, DOCX, or a text/code file instead.");
}

/** ZIP paths must stay relative; every segment gets a portable filename. */
export function safeProjectPath(name: string): string | undefined {
  if (/^[\\/]|^[a-z]:/i.test(name)) return undefined;
  const parts = name.replace(/\\/g, "/").split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) return undefined;
  const normalized: string[] = [];
  for (const part of parts) {
    // Spaces are valid in project names: preserve them so relative links work.
    const segment = part.normalize("NFC");
    if (!/^[\p{L}\p{N}\p{M}_. -]+$/u.test(segment) || /[. ]$/.test(segment) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment) || new TextEncoder().encode(segment).byteLength > 180) return undefined;
    normalized.push(segment);
  }
  return normalized.join("/");
}
