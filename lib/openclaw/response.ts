export function extractOpenClawText(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;

  const asAny = data as any;

  // OpenAI Chat Completions format
  const openAiText = asAny?.choices?.[0]?.message?.content;
  if (typeof openAiText === "string" && openAiText.trim()) {
    return openAiText;
  }

  // OpenResponses format
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
