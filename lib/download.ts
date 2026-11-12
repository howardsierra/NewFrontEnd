/** Portable filenames: preserve Unicode, avoid paths and reserved device names. */
export function exportFilename(name: string, extension: string, fallback = "export"): string {
  const ext = /^[a-z0-9]+$/i.test(extension) ? extension.toLowerCase() : "txt";
  let stem = name.normalize("NFC").trim().replace(new RegExp(`\\.${ext}$`, "i"), "")
    .replace(/[^\p{L}\p{N}\p{M}_.-]+/gu, "-").replace(/^[. -]+|[. -]+$/g, "");
  if (!stem) stem = fallback;
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem)) stem = `_${stem}`;
  let result = "";
  let bytes = 0;
  for (const char of stem) {
    const size = new TextEncoder().encode(char).byteLength;
    if (bytes + size > 180) break;
    result += char;
    bytes += size;
  }
  return `${result.replace(/[. -]+$/g, "") || "export"}.${ext}`;
}

/** Attach the link for browser compatibility and keep the URL alive through save. */
export function downloadFile(contents: string, filename: string, mime: string): void {
  downloadBlob(new Blob([contents], { type: `${mime};charset=utf-8` }), filename);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  try { link.click(); }
  finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}
