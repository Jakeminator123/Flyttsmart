import { postalToElArea, type ElArea } from "../elarea";
import type { CompareInput, CompareResult, CompareProvider } from "../compare";

const ELPRIS_BASE = "https://www.elprisetjustnu.se/api/v1/prices";

interface ElPriceEntry {
  SEK_per_kWh: number;
  EUR_per_kWh: number;
  EXR: number;
  time_start: string;
  time_end: string;
}

export interface ElPriceSummary {
  area: ElArea;
  date: string;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  currentPrice: number | null;
  entries: number;
  unit: "öre/kWh";
}

function toOrePerKwh(sek: number): number {
  return Math.round(sek * 100 * 100) / 100;
}

/**
 * Fetch today's spot prices for a given electricity area from elprisetjustnu.se.
 * Returns null if the API is unreachable or returns unexpected data.
 */
export async function fetchElPrices(area: ElArea): Promise<ElPriceSummary | null> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}/${mm}-${dd}`;

  const url = `${ELPRIS_BASE}/${dateStr}_${area}.json`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;

    const entries: ElPriceEntry[] = await res.json();
    if (!Array.isArray(entries) || entries.length === 0) return null;

    const prices = entries.map((e) => e.SEK_per_kWh);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

    const nowIso = now.toISOString();
    const currentEntry = entries.find(
      (e) => nowIso >= e.time_start && nowIso < e.time_end
    );

    return {
      area,
      date: `${yyyy}-${mm}-${dd}`,
      avgPrice: toOrePerKwh(avg),
      minPrice: toOrePerKwh(Math.min(...prices)),
      maxPrice: toOrePerKwh(Math.max(...prices)),
      currentPrice: currentEntry ? toOrePerKwh(currentEntry.SEK_per_kWh) : null,
      entries: entries.length,
      unit: "öre/kWh",
    };
  } catch (err) {
    console.error(`[electricity] Failed to fetch prices for ${area}:`, err);
    return null;
  }
}

/**
 * Build a CompareResult for electricity_contract using real spot price data.
 * Returns null if price data is unavailable (caller should fall back to web_search).
 */
export async function electricityApiHandler(
  input: CompareInput,
  elAreaStr?: string,
): Promise<CompareResult | null> {
  const elInfo = input.toPostal ? postalToElArea(input.toPostal) : null;
  const area = elInfo?.area ?? "SE3";

  const prices = await fetchElPrices(area);
  if (!prices) return null;

  const areaLabel = elInfo
    ? `${elInfo.area} (${elInfo.label})`
    : `${area} (antagit)`;

  const currentStr = prices.currentPrice !== null
    ? `Just nu: ${prices.currentPrice} ore/kWh.`
    : "";

  const providers: CompareProvider[] = [
    {
      name: "Rorligt elavtal (spotpris)",
      price: `Snitt idag: ${prices.avgPrice} ore/kWh`,
      pros: [
        "Foljer marknaden — billigare nar efterfragan ar lag",
        "Ingen bindningstid",
        "Enklast att byta fran",
      ],
      cons: [
        "Prissvangningar — kan bli dyrt vid toppar",
        `Dagens max: ${prices.maxPrice} ore/kWh`,
      ],
      url: "https://www.elprisetjustnu.se/",
    },
    {
      name: "Fast elavtal (1-3 ar)",
      price: "Varierar per leverantor och bindningstid",
      pros: [
        "Forutsagbart manadspris",
        "Skyddar mot pristoppar",
      ],
      cons: [
        "Ofta dyrare an rorligt i langden",
        "Bindningstid — uppsagningsavgift vid byte",
        "Missar laga priser",
      ],
    },
    {
      name: "Mixat elavtal",
      price: "Del fast + del rorligt",
      pros: [
        "Balans mellan trygghet och marknadspris",
        "Mindre kanslighet for pristoppar",
      ],
      cons: [
        "Mer komplext att jamfora",
        "Inte alla leverantorer erbjuder detta",
      ],
    },
  ];

  const summary = [
    `Spotpris i ${areaLabel} idag (${prices.date}):`,
    `${currentStr} Snitt: ${prices.avgPrice}, Lagst: ${prices.minPrice}, Hogst: ${prices.maxPrice} ore/kWh.`,
    `${prices.entries} prispunkter (kvartstimmar).`,
    "Priser ar exkl. moms, elnat, paslag och skatter.",
  ].join(" ");

  const tip =
    prices.avgPrice < 50
      ? "Spotpriset ar lagt just nu — ett rorligt avtal kan vara fordelaktigt."
      : prices.avgPrice > 150
        ? "Spotpriset ar hogt idag. Ett fast avtal kan ge trygghet, men jamfor paslaget noga."
        : "Spotpriset ar pa en normal niva. Jamfor paslag och bindningstid for att hitta basta avtalet.";

  return {
    taskKey: input.taskKey,
    category: "El",
    summary,
    providers,
    tip,
    sources: [
      "https://www.elprisetjustnu.se/",
      "https://www.elprisetjustnu.se/elpris-api",
    ],
    cached: false,
    mode: "api",
    ...(elAreaStr ? { elArea: elAreaStr } : { elArea: areaLabel }),
  };
}
