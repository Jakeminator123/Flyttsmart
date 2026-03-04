const BRAVE_API_KEY = (process.env.BRAVE_API_KEY ?? "").trim();
const BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";
const BRAVE_TIMEOUT_MS = 8_000;

export interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
}

export function isBraveConfigured(): boolean {
  return BRAVE_API_KEY.length > 0;
}

export async function braveWebSearch(
  query: string,
  count = 5,
): Promise<BraveSearchResult[]> {
  if (!BRAVE_API_KEY) return [];

  const params = new URLSearchParams({
    q: query,
    count: String(Math.min(count, 20)),
    search_lang: "sv",
    ui_lang: "sv-SE",
  });

  try {
    const res = await fetch(`${BRAVE_SEARCH_URL}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": BRAVE_API_KEY,
      },
      signal: AbortSignal.timeout(BRAVE_TIMEOUT_MS),
    });

    if (!res.ok) return [];

    const data = await res.json();
    const results = data?.web?.results;
    if (!Array.isArray(results)) return [];

    return results.slice(0, count).map((r: Record<string, unknown>) => ({
      title: String(r.title ?? ""),
      url: String(r.url ?? ""),
      description: String(r.description ?? ""),
    }));
  } catch {
    return [];
  }
}
