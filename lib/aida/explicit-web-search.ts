import { getOpenAIClient } from "@/lib/ai/openai";
import {
  braveWebSearch,
  isBraveConfigured,
  type BraveSearchResult,
} from "@/lib/services/brave-search";
import { extractTokenUsage, trackUsage } from "@/lib/usage/tracker";

const SUMMARIZE_MODEL = "gpt-4.1-mini";
const OPENAI_WEB_SEARCH_TIMEOUT_MS = 45_000;

export interface WebSearchTrackingContext {
  route?: string;
  sessionId?: string;
}

function foldDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function shouldRunExplicitWebSearch(message: string): boolean {
  const normalized = foldDiacritics(message.toLowerCase().trim());
  if (!normalized) return false;

  const triggerPatterns = [
    /\b(?:sok|soka|soker|sokte)\s+(?:pa\s+)?(?:natet|webben|internet)\b/,
    /\b(?:sok|soka|soker|sokte)\s+upp\s+(?:pa\s+)?(?:natet|webben|internet)\b/,
    /\bkolla\s+upp\s+(?:pa\s+)?(?:natet|webben|internet)\b/,
    /\bgoogla\b/,
    /\bweb[_\s-]?search(?:a|ar|ning)?\b/,
  ];

  return triggerPatterns.some((pattern) => pattern.test(normalized));
}

function formatBraveResults(results: BraveSearchResult[]): string {
  if (results.length === 0) return "";
  return results
    .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.description}`)
    .join("\n\n");
}

async function summarizeBraveResults(
  query: string,
  results: BraveSearchResult[],
  tracking?: WebSearchTrackingContext,
): Promise<string> {
  const client = getOpenAIClient();
  const model =
    (process.env.AIDA_WEB_SEARCH_MODEL ?? "").trim() ||
    (process.env.COMPARE_MODEL ?? "").trim() ||
    SUMMARIZE_MODEL;

  const formatted = formatBraveResults(results);
  const started = Date.now();

  try {
    const res = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "Du ar Aida, en svensk flyttassistent for Flytt.io. " +
            "Anvandaren bad om en webbsokning. Nedan finns sokresultat fran Brave Search. " +
            "Sammanfatta de viktigaste resultaten pa svenska i 2-4 meningar. " +
            "Var konkret och namnge kallor nar mojligt. " +
            "Om fragan galler persondata, anvand endast offentligt tillganglig information.",
        },
        {
          role: "user",
          content:
            `Fraga: ${query}\n\n` +
            `Sokresultat:\n${formatted}\n\n` +
            "Ge en kort sammanfattning pa svenska baserad pa dessa resultat.",
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const usage = extractTokenUsage(res.usage);
    trackUsage({
      provider: "openai",
      flow: "web_search",
      route: tracking?.route ?? "/api/unknown",
      sessionId: tracking?.sessionId,
      model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      durationMs: Date.now() - started,
      ok: true,
    });

    return res.choices?.[0]?.message?.content?.trim() ?? "";
  } catch (error) {
    trackUsage({
      provider: "openai",
      flow: "web_search",
      route: tracking?.route ?? "/api/unknown",
      sessionId: tracking?.sessionId,
      model,
      durationMs: Date.now() - started,
      ok: false,
    });
    throw error;
  }
}

function extractResponseText(response: any): string {
  const outputText = response?.output_text;
  if (typeof outputText === "string" && outputText.trim()) return outputText.trim();

  const fromOutput = response?.output
    ?.filter((item: any) => item?.type === "message")
    .flatMap((item: any) => item?.content ?? [])
    .filter((part: any) => part?.type === "output_text")
    .map((part: any) => String(part?.text ?? ""))
    .join("")
    .trim();

  return fromOutput || "";
}

async function fallbackOpenAIWebSearch(
  query: string,
  tracking?: WebSearchTrackingContext,
): Promise<string> {
  const client = getOpenAIClient();
  const model =
    (process.env.AIDA_WEB_SEARCH_MODEL ?? "").trim() ||
    (process.env.COMPARE_MODEL ?? "").trim() ||
    SUMMARIZE_MODEL;

  const timeoutSignal =
    typeof (AbortSignal as { timeout?: (ms: number) => AbortSignal }).timeout === "function"
      ? (AbortSignal as { timeout: (ms: number) => AbortSignal }).timeout(OPENAI_WEB_SEARCH_TIMEOUT_MS)
      : undefined;

  const started = Date.now();

  try {
    const response = await (client as any).responses.create(
      {
        model,
        input: [
          {
            role: "system",
            content:
              "Du ar Aida for Flytt.io. Anvand web_search for att hamta uppdaterad information pa internet. " +
              "Svara pa svenska i 2-4 meningar och var konkret. " +
              "Om fragan galler persondata, anvand endast offentligt tillganglig information.",
          },
          {
            role: "user",
            content:
              `Gor en webbsokning och svara pa den har fragan: ${query}\n` +
              "Om du kan, namnge kort de viktigaste kallorna i svaret.",
          },
        ],
        tools: [{ type: "web_search" }],
      },
      timeoutSignal ? { signal: timeoutSignal } : undefined,
    );

    const usage = extractTokenUsage((response as any)?.usage);
    trackUsage({
      provider: "openai",
      flow: "web_search_fallback",
      route: tracking?.route ?? "/api/unknown",
      sessionId: tracking?.sessionId,
      model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      durationMs: Date.now() - started,
      ok: true,
    });

    return extractResponseText(response);
  } catch (error) {
    trackUsage({
      provider: "openai",
      flow: "web_search_fallback",
      route: tracking?.route ?? "/api/unknown",
      sessionId: tracking?.sessionId,
      model,
      durationMs: Date.now() - started,
      ok: false,
    });
    throw error;
  }
}

/**
 * Brave-first web search: much cheaper than OpenAI's built-in web_search.
 * Flow: Brave Search API -> summarize with cheap model.
 * Falls back to OpenAI web_search if Brave key is missing or returns empty.
 */
export async function runExplicitWebSearch(
  message: string,
  tracking?: WebSearchTrackingContext,
): Promise<string> {
  const query = message.trim();
  if (!query) return "";

  if (isBraveConfigured()) {
    try {
      const results = await braveWebSearch(query, 6, {
        route: tracking?.route,
        sessionId: tracking?.sessionId,
        flow: "web_search",
      });
      if (results.length > 0) {
        const summary = await summarizeBraveResults(query, results, tracking);
        if (summary) return summary;
      }
    } catch (err) {
      console.warn("[explicit-web-search] Brave path failed, trying OpenAI fallback:", err);
    }
  }

  return fallbackOpenAIWebSearch(query, tracking);
}
