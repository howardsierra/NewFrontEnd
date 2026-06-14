// Snippet placeholders: {{variable}} tokens that get filled in on insert.

const TOKEN = /\{\{\s*([^{}]+?)\s*\}\}/g;

/** Unique placeholder names in first-appearance order. */
export function parsePlaceholders(body: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(TOKEN);
  while ((m = re.exec(body))) {
    const name = m[1].trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

export function hasPlaceholders(body: string): boolean {
  return parsePlaceholders(body).length > 0;
}

/**
 * Replace every {{name}} with its value. Blank values keep the literal token
 * so nothing is silently dropped.
 */
export function fillPlaceholders(
  body: string,
  values: Record<string, string>
): string {
  return body.replace(TOKEN, (full, raw) => {
    const v = values[String(raw).trim()];
    return v && v.length ? v : full;
  });
}
