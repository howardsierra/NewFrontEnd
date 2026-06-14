// A small, broadly useful starter pack offered on an empty library.
// Snippets are plain text; {{...}} placeholders are kept verbatim on insert so
// you can fill them in before sending.

export const STARTER_SNIPPETS: Array<{ title: string; body: string }> = [
  {
    title: "Summarize",
    body: "Summarize the following clearly and concisely. Lead with a one-sentence takeaway, then 3-5 bullet points of the key details:\n\n{{text}}",
  },
  {
    title: "Explain code",
    body: "Explain what the attached/below code does, step by step. Call out the overall purpose, any non-obvious logic, and potential bugs or edge cases.",
  },
  {
    title: "Code review",
    body: "Review this code for correctness, readability, performance, and security. List concrete issues ordered by severity, each with a suggested fix.",
  },
  {
    title: "Improve writing",
    body: "Rewrite the following to be clearer and more natural while preserving meaning and tone. Keep it roughly the same length:\n\n{{text}}",
  },
  {
    title: "JSON only",
    body: "Respond with ONLY valid minified JSON matching this shape, no prose, no code fences:\n{{schema}}",
  },
  {
    title: "Brainstorm",
    body: "Brainstorm 10 distinct, non-obvious ideas for {{topic}}. For each, give a one-line pitch and the main risk.",
  },
  {
    title: "Roleplay system prompt",
    body: "You are {{char}}, {{description}}. Stay fully in character. Write vivid, proactive replies in third person, italicizing actions. Never speak or act as {{user}}. Drive the scene forward and avoid repetition.",
  },
];
