import * as fs from "fs";
import * as path from "path";
import type { CompareInput, CompareResult, CompareProvider } from "../compare";

const PAP_API_KEY = process.env.PAP_API_KEY ?? "";

interface MunicipalityBroadband {
  municipality: string;
  municipalityCode?: string;
  fiberPercent: number | null;
  technologies: string[];
  topOperators: string[];
  householdsTotal: number | null;
  householdsWithBroadband: number | null;
}

interface PtsBroadbandData {
  generatedAt: string;
  source: string;
  municipalities: Record<string, MunicipalityBroadband>;
}

let ptsCache: PtsBroadbandData | null = null;
let ptsCacheTs = 0;
const PTS_CACHE_TTL_MS = 30 * 60 * 1000;

function loadPtsData(): PtsBroadbandData | null {
  if (ptsCache && Date.now() - ptsCacheTs < PTS_CACHE_TTL_MS) return ptsCache;

  const filePath = path.resolve(process.cwd(), "data/pts-broadband.json");
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    ptsCache = JSON.parse(raw) as PtsBroadbandData;
    ptsCacheTs = Date.now();
    return ptsCache;
  } catch {
    return null;
  }
}

function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/é/g, "e")
    .trim();
}

async function lookupMunicipalityFromPostal(postalCode: string): Promise<string | null> {
  if (!PAP_API_KEY) return null;
  const clean = postalCode.replace(/\s+/g, "");
  if (!/^\d{5}$/.test(clean)) return null;

  try {
    const res = await fetch(
      `https://api.papapi.se/lite/?query=${clean}&format=json&apikey=${PAP_API_KEY}`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.results?.[0];
    return item?.county?.trim() || item?.city?.trim() || null;
  } catch {
    return null;
  }
}

export async function broadbandApiHandler(
  input: CompareInput,
  elAreaStr?: string,
): Promise<CompareResult | null> {
  const ptsData = loadPtsData();
  if (!ptsData || Object.keys(ptsData.municipalities).length === 0) return null;

  let municipalityName: string | null = null;

  if (input.toCity) {
    municipalityName = input.toCity;
  }

  if (!municipalityName && input.toPostal) {
    municipalityName = await lookupMunicipalityFromPostal(input.toPostal);
  }

  if (!municipalityName) return null;

  const key = normalizeKey(municipalityName);
  const entry = ptsData.municipalities[key];
  if (!entry) return null;

  const providers: CompareProvider[] = [];

  if (entry.topOperators.length > 0) {
    for (const op of entry.topOperators.slice(0, 5)) {
      providers.push({
        name: op,
        price: "Se operatorens hemsida",
        pros: [
          `Aktiv i ${entry.municipality}`,
          ...(entry.technologies.length > 0
            ? [`Teknik: ${entry.technologies.join(", ")}`]
            : []),
        ],
        cons: ["Pris och tillganglighet beror pa exakt adress"],
      });
    }
  }

  if (entry.technologies.length > 0 && providers.length === 0) {
    for (const tech of entry.technologies.slice(0, 3)) {
      providers.push({
        name: tech,
        price: "Varierar per leverantor",
        pros: [`Tillganglig teknik i ${entry.municipality}`],
        cons: [],
      });
    }
  }

  const summaryParts: string[] = [];

  if (entry.fiberPercent !== null) {
    summaryParts.push(
      `I ${entry.municipality} har ${entry.fiberPercent}% av hushallen tillgang till fiber.`
    );
  }

  if (entry.technologies.length > 0) {
    summaryParts.push(
      `Tillgangliga tekniker: ${entry.technologies.join(", ")}.`
    );
  }

  if (entry.topOperators.length > 0) {
    summaryParts.push(
      `De storsta leverantorerna ar ${entry.topOperators.slice(0, 5).join(", ")}.`
    );
  }

  if (entry.householdsTotal !== null) {
    summaryParts.push(
      `Totalt ${entry.householdsTotal.toLocaleString("sv-SE")} hushall i kommunen.`
    );
  }

  if (summaryParts.length === 0) {
    summaryParts.push(`Bredbandsdata finns for ${entry.municipality} men detaljer saknas.`);
  }

  const tip = entry.fiberPercent !== null && entry.fiberPercent > 80
    ? "Hog fibertackning — kontrollera med din fastighetsagare om fiber redan ar installerat."
    : entry.fiberPercent !== null && entry.fiberPercent < 30
      ? "Lag fibertackning — mobilt bredband eller fast tradlost kan vara battre alternativ."
      : "Kontrollera exakt tillganglighet pa din adress hos operatorerna ovan.";

  return {
    taskKey: input.taskKey,
    category: "Bredband",
    summary: summaryParts.join(" "),
    providers,
    tip,
    sources: [
      "https://statistik.pts.se/",
      `PTS bredbandskartlaggning (data fran ${ptsData.generatedAt.slice(0, 10)})`,
    ],
    cached: false,
    mode: "api",
    ...(elAreaStr ? { elArea: elAreaStr } : {}),
  };
}
