import { downloadFile } from "./download";

const EXTENSIONS: Record<string, string> = {
  javascript: "js", js: "js", typescript: "ts", ts: "ts", jsx: "jsx", tsx: "tsx",
  python: "py", py: "py", ruby: "rb", rust: "rs", go: "go", java: "java",
  html: "html", css: "css", scss: "scss", json: "json", yaml: "yaml", yml: "yml",
  markdown: "md", md: "md", sql: "sql", bash: "sh", shell: "sh", sh: "sh",
  c: "c", cpp: "cpp", csharp: "cs", php: "php", swift: "swift", kotlin: "kt",
  xml: "xml", vue: "vue", svelte: "svelte", toml: "toml", text: "txt", plaintext: "txt",
};
export function codeFilename(language: string): string {
  return `snippet.${EXTENSIONS[language.toLowerCase()] ?? "txt"}`;
}

export function downloadCode(text: string, language: string) {
  downloadFile(text, codeFilename(language), "text/plain");
}
