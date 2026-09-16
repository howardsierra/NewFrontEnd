// SillyTavern "Chat Completion" preset builder.
//
// Targets SillyTavern 1.18.0. Produces JSON that imports directly via
// AI Response Configuration → Chat Completion Presets → Import.
// The editable surface here is the subset people actually tune; the exporter
// fills in the full prompt-manager structure (markers + dual prompt_order) so
// the result is a valid, ready-to-import preset.

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
  namesBehavior: number; // 0 none, 1 default, 2 completion, 3 content
  squashSystemMessages: boolean;
  useSysprompt: boolean; // ST 1.18: generalized "use system prompt" toggle
  mediaInlining: boolean; // ST 1.18: send images/media inline to the model

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
  topA: 0,
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
  scenarioFormat: "{{scenario}}",
  personalityFormat: "{{personality}}",
  assistantPrefill: "",
  namesBehavior: 0,
  squashSystemMessages: false,
  useSysprompt: false,
  mediaInlining: true,
  source: "openai",
  model: "",
};

const SOURCE_MAP: Record<ProviderKind, string> = {
  openai: "openai",
  anthropic: "claude",
  openrouter: "openrouter",
  gemini: "makersuite",
  custom: "custom",
};

// ST 1.18 ships two prompt_order entries. The global slot (100000) omits
// personaDescription; the default-character slot (100001) includes it.
const ORDER_GLOBAL = [
  "main",
  "worldInfoBefore",
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
const ORDER_DEFAULT = [
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

const makeOrder = (identifiers: string[]) =>
  identifiers.map((identifier) => ({
    identifier,
    // enhanceDefinitions is disabled by default in ST.
    enabled: identifier !== "enhanceDefinitions",
  }));

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
    markerPrompt("dialogueExamples", "Chat Examples"),
    textPrompt("jailbreak", "Post-History Instructions", d.postHistoryPrompt),
    markerPrompt("chatHistory", "Chat History"),
    markerPrompt("worldInfoAfter", "World Info (after)"),
    markerPrompt("worldInfoBefore", "World Info (before)"),
    textPrompt("enhanceDefinitions", "Enhance Definitions", d.enhanceDefinitions),
    markerPrompt("charDescription", "Char Description"),
    markerPrompt("charPersonality", "Char Personality"),
    markerPrompt("scenario", "Scenario"),
    markerPrompt("personaDescription", "Persona Description"),
  ];

  const source = SOURCE_MAP[d.source];

  return {
    chat_completion_source: source,
    openai_model: d.source === "openai" ? d.model : "gpt-4o",
    claude_model: d.source === "anthropic" ? d.model : "claude-3-5-sonnet-20241022",
    openrouter_model: d.source === "openrouter" ? d.model : "openai/gpt-4o",
    custom_model: d.source === "custom" ? d.model : "",
    custom_url: "",
    custom_include_body: "",
    custom_exclude_body: "",
    custom_include_headers: "",
    reverse_proxy: "",
    proxy_password: "",

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
    seed: -1,
    n: 1,

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
    bias_preset_selected: "Default (none)",

    assistant_prefill: d.assistantPrefill,
    assistant_impersonation: "",
    use_sysprompt: d.useSysprompt,
    squash_system_messages: d.squashSystemMessages,
    media_inlining: d.mediaInlining,
    continue_prefill: false,
    continue_postfix: " ",
    show_external_models: false,
    bypass_status_check: false,

    prompts,
    prompt_order: [
      { character_id: 100000, order: makeOrder(ORDER_GLOBAL) },
      { character_id: 100001, order: makeOrder(ORDER_DEFAULT) },
    ],
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
  d.namesBehavior = num(json.names_behavior, d.namesBehavior);
  d.squashSystemMessages = bool(json.squash_system_messages, d.squashSystemMessages);
  // Accept both the 1.18 name and the older Claude-specific key on import.
  d.useSysprompt = bool(
    json.use_sysprompt ?? json.claude_use_sysprompt,
    d.useSysprompt
  );
  d.mediaInlining = bool(json.media_inlining ?? json.image_inlining, d.mediaInlining);

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
