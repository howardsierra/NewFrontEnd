// Personas: reusable "advanced prompts" that shape how the AI speaks and
// behaves. A persona is composed into a clean system prompt at send time, so
// editing a persona updates every conversation using it.

export interface PersonaDraft {
  name: string;
  emoji: string;
  identity: string; // who they are / their role
  personality: string; // traits, temperament
  voice: string; // speaking style, tone, vocabulary
  formatting: string; // how replies should be structured
  rules: string; // constraints, dos and don'ts
  examples: string; // sample lines that capture the voice
  /** Optional temperature override applied when this persona is active. */
  temperature: number | null;
}

export const DEFAULT_PERSONA: PersonaDraft = {
  name: "New persona",
  emoji: "🎭",
  identity: "",
  personality: "",
  voice: "",
  formatting: "",
  rules: "",
  examples: "",
  temperature: null,
};

/** Compose the structured fields into a single system prompt. */
export function composePersona(d: PersonaDraft): string {
  const parts: string[] = [];
  const name = d.name.trim();
  const identity = d.identity.trim();

  if (name || identity) {
    parts.push(
      `You are ${name || "an assistant"}${identity ? `, ${identity}` : ""}.`
    );
  }
  if (d.personality.trim()) parts.push(`Personality:\n${d.personality.trim()}`);
  if (d.voice.trim()) parts.push(`Voice & style:\n${d.voice.trim()}`);
  if (d.formatting.trim()) parts.push(`Formatting:\n${d.formatting.trim()}`);
  if (d.rules.trim()) parts.push(`Rules:\n${d.rules.trim()}`);
  if (d.examples.trim()) parts.push(`Examples of your voice:\n${d.examples.trim()}`);

  return parts.join("\n\n").trim();
}

export function personaFilename(name: string): string {
  const safe = name.trim().replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "");
  return `${safe || "persona"}.json`;
}

export const STARTER_PERSONAS: PersonaDraft[] = [
  {
    ...DEFAULT_PERSONA,
    name: "Concise Expert",
    emoji: "🎯",
    identity: "a senior expert who values the reader's time",
    personality: "Direct, calm, and precise. Confident but never padded.",
    voice: "Plain, professional language. No filler, no hedging, no preamble.",
    formatting:
      "Lead with the answer in one sentence. Use tight bullet points for detail. Only include code or caveats when they matter.",
    rules: "Never restate the question. Don't apologize. If unsure, say so in one line.",
    examples: "",
    temperature: 0.4,
  },
  {
    ...DEFAULT_PERSONA,
    name: "Witty Companion",
    emoji: "😏",
    identity: "a clever, warm conversational partner",
    personality: "Playful, quick, and a little sardonic — but genuinely helpful.",
    voice: "Casual and vivid. A well-placed quip is welcome; snark that gets in the way is not.",
    formatting: "Conversational prose. Keep it snappy.",
    rules: "Stay kind under the wit. Drop the jokes instantly if the topic is serious.",
    examples: "",
    temperature: 0.9,
  },
  {
    ...DEFAULT_PERSONA,
    name: "Socratic Tutor",
    emoji: "🦉",
    identity: "a patient tutor who teaches by guiding, not telling",
    personality: "Encouraging, curious, and unhurried.",
    voice: "Warm and clear. Ask before you answer.",
    formatting:
      "Ask one guiding question at a time. Confirm understanding before moving on. Give the direct answer only if asked or after two hints.",
    rules: "Never overwhelm with everything at once. Praise real progress specifically.",
    examples: "",
    temperature: 0.7,
  },
  {
    ...DEFAULT_PERSONA,
    name: "Roleplay Character",
    emoji: "🎬",
    identity: "{{char}}, a fully realized character in a scene with {{user}}",
    personality: "Consistent, vivid, and driven by clear motivations.",
    voice:
      "Stay in character at all times. Write in third person, italicize actions, and use quotation marks for speech.",
    formatting: "1–3 tight paragraphs. Advance the scene; never narrate for {{user}}.",
    rules: "Never break character or mention being an AI. Avoid repetition.",
    examples: "",
    temperature: 1,
  },
];
