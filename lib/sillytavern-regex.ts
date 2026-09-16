// SillyTavern Regex script builder (targets ST 1.18.0).
// Exported JSON imports via Extensions → Regex → Import.

import { nanoid } from "nanoid";

// From SillyTavern's regex engine.js
export const REGEX_PLACEMENT = {
  USER_INPUT: 1,
  AI_OUTPUT: 2,
  SLASH_COMMAND: 3,
  WORLD_INFO: 5,
  REASONING: 6,
} as const;

export const PLACEMENT_LABELS: Array<{ value: number; label: string; hint: string }> = [
  { value: 2, label: "AI Output", hint: "The model's replies" },
  { value: 1, label: "User Input", hint: "What you type" },
  { value: 6, label: "Reasoning", hint: "Thinking / reasoning blocks" },
  { value: 5, label: "World Info", hint: "Lorebook entries" },
  { value: 3, label: "Slash Commands", hint: "/command output" },
];

export const SUBSTITUTE = { NONE: 0, RAW: 1, ESCAPED: 2 } as const;

export interface RegexDraft {
  scriptName: string;
  findRegex: string;
  replaceString: string;
  trimStrings: string[];
  placement: number[];
  disabled: boolean;
  markdownOnly: boolean; // affect display only
  promptOnly: boolean; // affect prompt only
  runOnEdit: boolean;
  substituteRegex: number;
  minDepth: number | null;
  maxDepth: number | null;
}

export const DEFAULT_REGEX: RegexDraft = {
  scriptName: "My Regex",
  findRegex: "",
  replaceString: "",
  trimStrings: [],
  placement: [REGEX_PLACEMENT.AI_OUTPUT],
  disabled: false,
  markdownOnly: true,
  promptOnly: false,
  runOnEdit: false,
  substituteRegex: SUBSTITUTE.NONE,
  minDepth: null,
  maxDepth: null,
};

/** Build a full, importable SillyTavern regex script object. */
export function buildRegexScript(d: RegexDraft): Record<string, unknown> {
  return {
    id: nanoid(),
    scriptName: d.scriptName,
    findRegex: d.findRegex,
    replaceString: d.replaceString,
    trimStrings: d.trimStrings.filter((t) => t.length > 0),
    placement: d.placement.length ? d.placement : [REGEX_PLACEMENT.AI_OUTPUT],
    disabled: d.disabled,
    markdownOnly: d.markdownOnly,
    promptOnly: d.promptOnly,
    substituteRegex: d.substituteRegex,
    runOnEdit: d.runOnEdit,
    minDepth: d.minDepth,
    maxDepth: d.maxDepth,
  };
}

export function parseRegexScript(json: any, fallbackName = "Imported Regex"): RegexDraft {
  const d: RegexDraft = { ...DEFAULT_REGEX, scriptName: fallbackName };
  const str = (v: any, def: string) => (typeof v === "string" ? v : def);
  const bool = (v: any, def: boolean) => (typeof v === "boolean" ? v : def);
  d.scriptName = str(json.scriptName, d.scriptName);
  d.findRegex = str(json.findRegex, d.findRegex);
  d.replaceString = str(json.replaceString, d.replaceString);
  if (Array.isArray(json.trimStrings)) d.trimStrings = json.trimStrings.map(String);
  if (Array.isArray(json.placement)) d.placement = json.placement.filter((n: any) => typeof n === "number");
  d.disabled = bool(json.disabled, d.disabled);
  d.markdownOnly = bool(json.markdownOnly, d.markdownOnly);
  d.promptOnly = bool(json.promptOnly, d.promptOnly);
  d.runOnEdit = bool(json.runOnEdit, d.runOnEdit);
  if (typeof json.substituteRegex === "number") d.substituteRegex = json.substituteRegex;
  d.minDepth = typeof json.minDepth === "number" ? json.minDepth : null;
  d.maxDepth = typeof json.maxDepth === "number" ? json.maxDepth : null;
  return d;
}

/** Split a `/pattern/flags` string into its parts; falls back to a literal pattern. */
function splitRegex(input: string): { pattern: string; flags: string } {
  const m = /^\/((?:\\.|[^/])+)\/([a-z]*)$/i.exec(input.trim());
  if (m) return { pattern: m[1], flags: m[2] };
  return { pattern: input, flags: "" };
}

export interface RegexTestResult {
  ok: boolean;
  output: string;
  error?: string;
  matchCount: number;
}

/**
 * Apply a regex script to sample text, mirroring SillyTavern's substitution:
 * {{match}} → the (trimmed) matched text, $1..$n → capture groups. Always runs
 * globally so the preview shows every replacement.
 */
export function testRegex(d: RegexDraft, sample: string): RegexTestResult {
  if (!d.findRegex.trim()) {
    return { ok: true, output: sample, matchCount: 0 };
  }
  const { pattern, flags } = splitRegex(d.findRegex);
  let re: RegExp;
  try {
    const withGlobal = flags.includes("g") ? flags : flags + "g";
    re = new RegExp(pattern, withGlobal);
  } catch (e: any) {
    return { ok: false, output: "", error: e.message || "Invalid regex", matchCount: 0 };
  }

  let count = 0;
  try {
    const output = sample.replace(re, (...args) => {
      count++;
      const groups = args.slice(1, -2) as string[];
      const full = args[0] as string;
      let matched = full;
      for (const t of d.trimStrings) {
        if (t) matched = matched.split(t).join("");
      }
      let out = d.replaceString.replace(/\{\{match\}\}/gi, matched);
      out = out.replace(/\$(\d+)/g, (_m, n) => groups[+n - 1] ?? "");
      return out;
    });
    return { ok: true, output, matchCount: count };
  } catch (e: any) {
    return { ok: false, output: "", error: e.message || "Replacement failed", matchCount: 0 };
  }
}

export function regexFilename(name: string): string {
  const safe = name.trim().replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "");
  return `${safe || "regex"}.json`;
}

/** A few broadly-useful starter scripts. */
export const STARTER_REGEX: RegexDraft[] = [
  {
    ...DEFAULT_REGEX,
    scriptName: "Hide <think> reasoning (display)",
    findRegex: "/<think>[\\s\\S]*?<\\/think>/gi",
    replaceString: "",
    placement: [REGEX_PLACEMENT.AI_OUTPUT, REGEX_PLACEMENT.REASONING],
    markdownOnly: true,
  },
  {
    ...DEFAULT_REGEX,
    scriptName: "Strip stray HTML tags",
    findRegex: "/<(?!\\/?(code|pre|em|strong|b|i)\\b)[^>]+>/gi",
    replaceString: "",
    placement: [REGEX_PLACEMENT.AI_OUTPUT],
    markdownOnly: true,
  },
  {
    ...DEFAULT_REGEX,
    scriptName: "Curly quotes → straight",
    findRegex: "/[\\u201C\\u201D]/g",
    replaceString: '"',
    placement: [REGEX_PLACEMENT.AI_OUTPUT, REGEX_PLACEMENT.USER_INPUT],
    markdownOnly: true,
  },
];
