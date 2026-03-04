import { eniroCompanySearch } from "@/lib/services/eniro";
import type { CompareInput, CompareResult, CompareProvider } from "../compare";

async function eniroLocalHandler(
  input: CompareInput,
  searchWord: string,
  category: string,
  elAreaStr?: string,
): Promise<CompareResult | null> {
  const city = input.toCity?.trim();
  if (!city) return null;

  const results = await eniroCompanySearch(searchWord, city, {
    flow: "comparison",
    route: `/api/compare/${input.taskKey}`,
  });
  if (results.length === 0) return null;

  const providers: CompareProvider[] = results.map((r) => ({
    name: r.title || "Okant foretag",
    price: "Begar offert",
    pros: [
      `Lokal firma i ${city}`,
      "Verifierad via Eniro",
      ...(r.address ? [`Adress: ${r.address}${r.zipCode ? `, ${r.zipCode}` : ""} ${r.city ?? ""}`] : []),
    ],
    cons: ["Pris ej tillgangligt — kontakta for offert"],
    ...(r.phoneNumber ? { url: `tel:${r.phoneNumber.replace(/\s+/g, "")}` } : {}),
  }));

  const phoneList = results
    .filter((r) => r.phoneNumber)
    .map((r) => `${r.title}: ${r.phoneNumber}`)
    .join(", ");

  return {
    taskKey: input.taskKey,
    category,
    summary: `${results.length} lokala ${searchWord}-firmor hittades i ${city} via Eniro.${phoneList ? ` Telefon: ${phoneList}.` : ""}`,
    providers,
    tip: `Ring och begar offert fran minst 2-3 firmor for att jamfora pris och tillganglighet.`,
    sources: [
      `https://www.eniro.se/`,
      `https://api.eniro.com/cs/search/basic?search_word=${encodeURIComponent(searchWord)}&geo_area=${encodeURIComponent(city)}`,
    ],
    cached: false,
    mode: "api",
    ...(elAreaStr ? { elArea: elAreaStr } : {}),
  };
}

export async function moversApiHandler(
  input: CompareInput,
  elAreaStr?: string,
): Promise<CompareResult | null> {
  return eniroLocalHandler(input, "flyttfirma", "Flyttfirma", elAreaStr);
}

export async function cleaningApiHandler(
  input: CompareInput,
  elAreaStr?: string,
): Promise<CompareResult | null> {
  return eniroLocalHandler(input, "flyttstädning", "Flyttstädning", elAreaStr);
}
