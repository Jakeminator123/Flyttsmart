export interface EmailRequestBlock {
  to: string;
  subject: string;
  includeFields: boolean;
  includeChecklist: boolean;
}

export interface OpenClawParsed {
  text: string | null;
  suggestions: Record<string, string> | null;
  emailRequest: EmailRequestBlock | null;
}

const SUGGESTION_RE = /```suggestion\s*\n([\s\S]*?)\n```/;
const EMAIL_REQUEST_RE = /```email_request\s*\n([\s\S]*?)\n```/;

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
  let emailRequest: EmailRequestBlock | null = null;

  const suggestionMatch = raw.match(SUGGESTION_RE);
  if (suggestionMatch) {
    try {
      const parsed = JSON.parse(suggestionMatch[1].trim());
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        suggestions = parsed as Record<string, string>;
      }
    } catch {
      // Malformed JSON - ignore
    }
  }

  const emailMatch = raw.match(EMAIL_REQUEST_RE);
  if (emailMatch) {
    try {
      const parsed = JSON.parse(emailMatch[1].trim());
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        emailRequest = {
          to: typeof parsed.to === "string" ? parsed.to.trim() : "",
          subject: typeof parsed.subject === "string" ? parsed.subject.trim() : "Sammanfattning av din flytt",
          includeFields: parsed.includeFields !== false,
          includeChecklist: parsed.includeChecklist !== false,
        };
      }
    } catch {
      // Malformed JSON - ignore
    }
  }

  const text = raw
    .replace(SUGGESTION_RE, "")
    .replace(EMAIL_REQUEST_RE, "")
    .trim() || null;

  return { text, suggestions, emailRequest };
}
