/**
 * Classify an incoming user message to determine the optimal response path.
 *
 * "direct"     — pattern-matched field fill ("fyll i Jakob i förnamn")
 * "simple"     — quick knowledge question, greeting, or step question
 * "comparison" — user asks about el, bredband, försäkring, etc.
 * "general"    — everything else (needs full enrichment + gateway)
 */

export type MessageIntent = "direct" | "simple" | "comparison" | "general";

const GREETING_ONLY_VALUES = new Set([
  "hej",
  "hejsan",
  "hallå",
  "halla",
  "tjena",
  "tja",
  "tjabba",
  "yo",
  "hello",
  "god morgon",
  "god dag",
  "god kväll",
  "god kvall",
]);

const SIMPLE_PATTERNS = [
  /^(hej|hallå|tjena|hejsan|god\s*(morgon|kväll|dag)|tack|okej|ok)\b/i,
  /vad\s+(är|betyder|innebär)\s+(en?\s+)?(fastighets(beteckning|ägare)|lägenhetsnr|lägenhetsnummer|personnummer|postnummer|inflyttningsdatum)/i,
  /vilka\s+(steg|fält|uppgifter)\s+(finns|har|behövs)/i,
  /hur\s+(fungerar|funkar)\s+(formuläret|flytten|sajten|adressändring)/i,
  /vad\s+(händer|gör)\s+(i|på|vid)\s+steg\s+\d/i,
  /förklara\s+(steg|fält|formulär)/i,
  /behöver\s+jag\s+(fylla|ange|skriva)/i,
  /var\s+hittar\s+jag/i,
  /vad\s+(ska|bör)\s+jag\s+(göra|börja)/i,
];

const COMPARISON_KEYWORDS: Record<string, string[]> = {
  electricity_contract: ["el", "elavtal", "elbolag", "elpris", "elomrade", "elområde", "elnät"],
  broadband_order_install: ["bredband", "fiber", "internet", "wifi"],
  home_insurance: ["hemförsäkring", "hemforsakring", "försäkring", "forsakring"],
  movers_or_trailer: ["flyttfirma", "flytt firma", "flytthjälp", "flytthjalp", "släpvagn", "slapvagn"],
  cleaning_service: ["städ", "stad", "flyttstäd", "flyttstad", "städfirma", "stadfirma"],
};

function normalizeMessage(message: string): string {
  return message
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isGreetingOnlyMessage(message: string): boolean {
  const normalized = normalizeMessage(message);
  if (!normalized) return false;
  if (GREETING_ONLY_VALUES.has(normalized)) return true;

  // Common follow-up after prior misunderstanding.
  if (/^men jag s[äa]ger ju bara hej$/.test(normalized)) return true;
  return false;
}

export function isSiteCapabilitiesQuestion(message: string): boolean {
  const normalized = normalizeMessage(message);
  if (!normalized) return false;

  return (
    /vad kan jag gora pa denna sajt/.test(normalized) ||
    /vad kan jag gora har/.test(normalized) ||
    /vad kan man gora pa denna sajt/.test(normalized) ||
    /vad kan ni hjalpa mig med/.test(normalized) ||
    /vad gor den har sajten/.test(normalized) ||
    /vad ar det har for sajt/.test(normalized)
  );
}

export function classifyMessage(message: string): {
  intent: MessageIntent;
  comparisonTasks: string[];
} {
  const lower = message.toLowerCase().trim();

  if (SIMPLE_PATTERNS.some((re) => re.test(lower))) {
    return { intent: "simple", comparisonTasks: [] };
  }

  const comparisonTasks: string[] = [];
  for (const [taskKey, keywords] of Object.entries(COMPARISON_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      comparisonTasks.push(taskKey);
    }
  }

  if (comparisonTasks.length > 0) {
    return { intent: "comparison", comparisonTasks };
  }

  return { intent: "general", comparisonTasks: [] };
}

export { COMPARISON_KEYWORDS };
