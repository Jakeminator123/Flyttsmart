export interface OpenClawParsed {
  text: string | null;
  suggestions: Record<string, string> | null;
}

const SUGGESTION_RE = /```suggestion\s*\n([\s\S]*?)\n```/;

/**
 * Extract text content from an OpenClaw / OpenAI response object.
 */
export function extractOpenClawText(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;

  const asAny = data as any;

  const openAiText = asAny?.choices?.[0]?.message?.content;
  if (typeof openAiText === "string" && openAiText.trim()) {
    return openAiText;
  }

  if (Array.isArray(asAny?.output)) {
    const parts: string[] = [];
    for (const item of asAny.output) {
      if (item?.type !== "message" || !Array.isArray(item?.content)) continue;
      for (const content of item.content) {
        if (content?.type === "output_text" && typeof content?.text === "string") {
          parts.push(content.text);
        }
      }
    }
    const joined = parts.join("").trim();
    if (joined) return joined;
  }

  if (typeof asAny?.content === "string" && asAny.content.trim()) {
    return asAny.content;
  }

  return null;
}

/**
 * Parse a response string into visible text and optional field suggestions.
 * Suggestions are embedded as fenced code blocks with the "suggestion" tag:
 *
 *   ```suggestion
 *   {"toPostal":"41119","toCity":"Göteborg"}
 *   ```
 */
export function parseOpenClawResponse(raw: string): OpenClawParsed {
  let suggestions: Record<string, string> | null = null;

  const match = raw.match(SUGGESTION_RE);
  if (match) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        suggestions = parsed as Record<string, string>;
      }
    } catch {
      // Malformed JSON - ignore
    }
  }

  const text = raw.replace(SUGGESTION_RE, "").trim() || null;
  return { text, suggestions };
}
