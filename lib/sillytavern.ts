// SillyTavern "Chat Completion" preset builder.
//
// Produces JSON that imports directly via SillyTavern's
// AI Response Configuration → Chat Completion Presets → Import.
// The editable surface here is the subset people actually tune; the exporter
// fills in the full prompt-manager structure (markers + prompt_order) so the
// result is a valid, ready-to-import preset.

import type { ProviderKind } from "./types";

export interface PresetDraft {
  name: string;

  // Samplers
  temperature: number;
  frequencyPenalty: number;
  presencePenalty: number;
  topP: number;
  topK: number;
  topA: number;
  minP: number;
  repetitionPenalty: number;

  // Context / output
  maxContext: number;
  maxTokens: number;
  stream: boolean;

  // Core prompts (Prompt Manager)
  mainPrompt: string; // identifier: main
  auxiliaryPrompt: string; // identifier: nsfw ("Auxiliary Prompt")
  postHistoryPrompt: string; // identifier: jailbreak ("Post-History Instructions")
  enhanceDefinitions: string; // identifier: enhanceDefinitions

  // Utility prompts
  impersonationPrompt: string;
  newChatPrompt: string;
  newGroupChatPrompt: string;
  newExampleChatPrompt: string;
  continueNudgePrompt: string;
  groupNudgePrompt: string;

  // Formats
  wiFormat: string;
  scenarioFormat: string;
  personalityFormat: string;

  // Behavior
  assistantPrefill: string;
  wrapInQuotes: boolean;
  namesBehavior: number; // 0 none, 1 default, 2 completion, 3 content
  squashSystemMessages: boolean;
  claudeUseSysprompt: boolean;

  // Provenance (for the matching ST source/model fields)
  source: ProviderKind;
  model: string;
}

export const DEFAULT_DRAFT: PresetDraft = {
  name: "My Preset",
  temperature: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  topP: 1,
  topK: 0,
  topA: 1,
  minP: 0,
  repetitionPenalty: 1,
  maxContext: 16384,
  maxTokens: 1024,
  stream: true,
  mainPrompt:
    "Write {{char}}'s next reply in a fictional chat between {{char}} and {{user}}. Write 1 reply only in internet RP style, italicize actions, and avoid quotation marks. Use markdown. Be proactive, creative, and drive the plot and conversation forward. Always stay in character and avoid repetition.",
  auxiliaryPrompt: "",
  postHistoryPrompt: "",
  enhanceDefinitions: "",
  impersonationPrompt:
    "[Write your next reply from the point of view of {{user}}, using the preceding context so far as references.]",
  newChatPrompt: "[Start a new Chat]",
  newGroupChatPrompt: "[Start a new group chat. Group members: {{group}}]",
  newExampleChatPrompt: "[Example Chat]",
  continueNudgePrompt:
    "[Continue your last message without repeating its original content.]",
  groupNudgePrompt:
    "[Write the next reply only as {{char}}.]",
  wiFormat: "{0}",
  scenarioFormat: "[Circumstances and context of the dialogue: {{scenario}}]",
  personalityFormat: "[{{char}}'s personality: {{personality}}]",
  assistantPrefill: "",
  wrapInQuotes: false,
  namesBehavior: 0,
  squashSystemMessages: false,
  claudeUseSysprompt: false,
  source: "openai",
  model: "",
};

const SOURCE_MAP: Record<ProviderKind, string> = {
  openai: "openai",
  anthropic: "claude",
  openrouter: "openrouter",
  custom: "custom",
};

/** Standard prompt-manager order for a fresh preset. */
const PROMPT_ORDER = [
  "main",
  "worldInfoBefore",
  "personaDescription",
  "charDescription",
  "charPersonality",
  "scenario",
  "enhanceDefinitions",
  "nsfw",
  "worldInfoAfter",
  "dialogueExamples",
  "chatHistory",
  "jailbreak",
];

const MARKERS: Array<{ identifier: string; name: string }> = [
  { identifier: "worldInfoBefore", name: "World Info (before)" },
  { identifier: "worldInfoAfter", name: "World Info (after)" },
  { identifier: "charDescription", name: "Char Description" },
  { identifier: "charPersonality", name: "Char Personality" },
  { identifier: "scenario", name: "Scenario" },
  { identifier: "personaDescription", name: "Persona Description" },
  { identifier: "dialogueExamples", name: "Chat Examples" },
  { identifier: "chatHistory", name: "Chat History" },
];

/** Build a full, importable SillyTavern Chat Completion preset object. */
export function buildPreset(d: PresetDraft): Record<string, unknown> {
  const textPrompt = (
    identifier: string,
    name: string,
    content: string,
    role = "system"
  ) => ({
    identifier,
    name,
    system_prompt: true,
    role,
    content,
    injection_position: 0,
    injection_depth: 4,
    forbid_overrides: false,
    marker: false,
  });

  const markerPrompt = (identifier: string, name: string) => ({
    identifier,
    name,
    system_prompt: true,
    marker: true,
  });

  const prompts = [
    textPrompt("main", "Main Prompt", d.mainPrompt),
    textPrompt("nsfw", "Auxiliary Prompt", d.auxiliaryPrompt),
    textPrompt("jailbreak", "Post-History Instructions", d.postHistoryPrompt),
    textPrompt("enhanceDefinitions", "Enhance Definitions", d.enhanceDefinitions),
    ...MARKERS.map((m) => markerPrompt(m.identifier, m.name)),
  ];

  const order = PROMPT_ORDER.map((identifier) => ({
    identifier,
    // enhanceDefinitions is off by default in ST.
    enabled: identifier !== "enhanceDefinitions",
  }));

  const source = SOURCE_MAP[d.source];

  return {
    chat_completion_source: source,
    openai_model: d.source === "openai" ? d.model : "gpt-4o",
    claude_model: d.source === "anthropic" ? d.model : "claude-3-5-sonnet-20241022",
    openrouter_model: d.source === "openrouter" ? d.model : "openai/gpt-4o",
    custom_model: d.source === "custom" ? d.model : "",

    temperature: d.temperature,
    frequency_penalty: d.frequencyPenalty,
    presence_penalty: d.presencePenalty,
    top_p: d.topP,
    top_k: d.topK,
    top_a: d.topA,
    min_p: d.minP,
    repetition_penalty: d.repetitionPenalty,

    openai_max_context: d.maxContext,
    openai_max_tokens: d.maxTokens,
    max_context_unlocked: d.maxContext > 100000,
    stream_openai: d.stream,

    wrap_in_quotes: d.wrapInQuotes,
    names_behavior: d.namesBehavior,
    send_if_empty: "",
    impersonation_prompt: d.impersonationPrompt,
    new_chat_prompt: d.newChatPrompt,
    new_group_chat_prompt: d.newGroupChatPrompt,
    new_example_chat_prompt: d.newExampleChatPrompt,
    continue_nudge_prompt: d.continueNudgePrompt,
    group_nudge_prompt: d.groupNudgePrompt,
    wi_format: d.wiFormat,
    scenario_format: d.scenarioFormat,
    personality_format: d.personalityFormat,

    assistant_prefill: d.assistantPrefill,
    human_sysprompt_message: "",
    claude_use_sysprompt: d.claudeUseSysprompt,
    use_makersuite_sysprompt: true,
    squash_system_messages: d.squashSystemMessages,
    image_inlining: true,
    continue_postfix: " ",
    bias_preset_selected: "Default (none)",
    show_thoughts: true,
    reasoning_effort: "medium",

    prompts,
    prompt_order: [{ character_id: 100001, order }],
  };
}

/** Best-effort import: pull editable fields back out of a preset JSON. */
export function parsePreset(json: any, fallbackName = "Imported Preset"): PresetDraft {
  const d: PresetDraft = { ...DEFAULT_DRAFT, name: fallbackName };
  const num = (v: any, def: number) => (typeof v === "number" ? v : def);
  const str = (v: any, def: string) => (typeof v === "string" ? v : def);
  const bool = (v: any, def: boolean) => (typeof v === "boolean" ? v : def);

  d.temperature = num(json.temperature, d.temperature);
  d.frequencyPenalty = num(json.frequency_penalty, d.frequencyPenalty);
  d.presencePenalty = num(json.presence_penalty, d.presencePenalty);
  d.topP = num(json.top_p, d.topP);
  d.topK = num(json.top_k, d.topK);
  d.topA = num(json.top_a, d.topA);
  d.minP = num(json.min_p, d.minP);
  d.repetitionPenalty = num(json.repetition_penalty, d.repetitionPenalty);
  d.maxContext = num(json.openai_max_context, d.maxContext);
  d.maxTokens = num(json.openai_max_tokens, d.maxTokens);
  d.stream = bool(json.stream_openai, d.stream);

  d.impersonationPrompt = str(json.impersonation_prompt, d.impersonationPrompt);
  d.newChatPrompt = str(json.new_chat_prompt, d.newChatPrompt);
  d.newGroupChatPrompt = str(json.new_group_chat_prompt, d.newGroupChatPrompt);
  d.newExampleChatPrompt = str(json.new_example_chat_prompt, d.newExampleChatPrompt);
  d.continueNudgePrompt = str(json.continue_nudge_prompt, d.continueNudgePrompt);
  d.groupNudgePrompt = str(json.group_nudge_prompt, d.groupNudgePrompt);
  d.wiFormat = str(json.wi_format, d.wiFormat);
  d.scenarioFormat = str(json.scenario_format, d.scenarioFormat);
  d.personalityFormat = str(json.personality_format, d.personalityFormat);
  d.assistantPrefill = str(json.assistant_prefill, d.assistantPrefill);
  d.wrapInQuotes = bool(json.wrap_in_quotes, d.wrapInQuotes);
  d.namesBehavior = num(json.names_behavior, d.namesBehavior);
  d.squashSystemMessages = bool(json.squash_system_messages, d.squashSystemMessages);
  d.claudeUseSysprompt = bool(json.claude_use_sysprompt, d.claudeUseSysprompt);

  // Pull the editable text prompts out of the prompt-manager array.
  if (Array.isArray(json.prompts)) {
    const byId: Record<string, any> = {};
    for (const p of json.prompts) if (p?.identifier) byId[p.identifier] = p;
    d.mainPrompt = str(byId.main?.content, d.mainPrompt);
    d.auxiliaryPrompt = str(byId.nsfw?.content, d.auxiliaryPrompt);
    d.postHistoryPrompt = str(byId.jailbreak?.content, d.postHistoryPrompt);
    d.enhanceDefinitions = str(byId.enhanceDefinitions?.content, d.enhanceDefinitions);
  }

  // Reverse-map the source.
  const src = json.chat_completion_source;
  const rev: Record<string, ProviderKind> = {
    openai: "openai",
    claude: "anthropic",
    openrouter: "openrouter",
    custom: "custom",
  };
  if (typeof src === "string" && rev[src]) d.source = rev[src];

  return d;
}

export function presetFilename(name: string): string {
  const safe = name.trim().replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "");
  return `${safe || "preset"}.json`;
}
