const ENIRO_API_KEY = process.env.ENIRO_API_KEY ?? "";

export interface EniroResult {
  title?: string;
  address?: string;
  phoneNumber?: string;
  city?: string;
  zipCode?: string;
}

export async function eniroCompanySearch(
  query: string,
  geoArea?: string
): Promise<EniroResult[]> {
  if (!ENIRO_API_KEY || !query.trim()) return [];
  try {
    const params = new URLSearchParams({
      profile: "APIGW",
      key: ENIRO_API_KEY,
      country: "se",
      search_word: query,
    });
    if (geoArea) params.set("geo_area", geoArea);

    const res = await fetch(
      `https://api.eniro.com/cs/search/basic?${params.toString()}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const adverts = data?.adverts;
    if (!Array.isArray(adverts)) return [];

    return adverts.slice(0, 5).map((a: Record<string, unknown>) => ({
      title: String(a.companyName ?? ""),
      address: String(a.address ?? ""),
      phoneNumber: String(a.phoneNumber ?? ""),
      city: String(a.city ?? ""),
      zipCode: String(a.zipCode ?? ""),
    }));
  } catch {
    return [];
  }
}
