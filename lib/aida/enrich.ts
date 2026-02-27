/**
 * Pre-enrichment: before Aida answers, we look up data from our APIs
 * and inject the results into her context so she can give informed answers.
 *
 * Sources:
 *  - PAP API (postnummer -> ort/kommun/lan/koordinater)
 *  - Eniro API (person/adress-sok i Sverige)
 *  - Personnummer-parsing (fodelsedatum, alder)
 *  - Flyttdatum-analys (tidsfrister, prioriteringar)
 */

const PAP_API_KEY = process.env.PAP_API_KEY ?? "";
const ENIRO_API_KEY = process.env.ENIRO_API_KEY ?? "";
const NOMINATIM_ENABLED =
  (process.env.NOMINATIM_ENABLED ?? "true").trim().toLowerCase() !== "false";
const SCB_ENABLED =
  (process.env.SCB_ENABLED ?? "false").trim().toLowerCase() === "y" ||
  (process.env.SCB_ENABLED ?? "false").trim().toLowerCase() === "true";
const SCB_YEAR = (process.env.SCB_YEAR ?? "2024").trim();
const SCB_TABLE_ID = (process.env.SCB_TABLE_ID ?? "TAB638").trim();

interface FormFields {
  firstName?: string;
  lastName?: string;
  personalNumber?: string;
  email?: string;
  phone?: string;
  fromStreet?: string;
  fromPostal?: string;
  fromCity?: string;
  toStreet?: string;
  toPostal?: string;
  toCity?: string;
  apartmentNumber?: string;
  propertyDesignation?: string;
  propertyOwner?: string;
  moveDate?: string;
  [key: string]: unknown;
}

interface EniroResult {
  title?: string;
  address?: string;
  phoneNumber?: string;
  city?: string;
  zipCode?: string;
}

interface NominatimResult {
  displayName: string;
  lat: string;
  lon: string;
  type: string;
  addressParts: {
    road?: string;
    suburb?: string;
    city?: string;
    municipality?: string;
    county?: string;
    postcode?: string;
    country?: string;
  };
}

interface ScbPopulation {
  municipality: string;
  population: number;
  growth: number;
  year: string;
}

interface EnrichmentResult {
  postalLookups: Record<string, { city: string; municipality?: string; county?: string }>;
  nominatimResults: NominatimResult[];
  eniroResults: EniroResult[];
  scbData: ScbPopulation | null;
  personInsights: string[];
  fieldHelp: string[];
  moveDateInsights: string[];
  comparisonOpportunities: string[];
}

const SCB_CACHE = new Map<string, { data: ScbPopulation; ts: number }>();
const SCB_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

async function lookupPostal(postalCode: string): Promise<{
  city: string;
  municipality?: string;
  county?: string;
} | null> {
  const clean = postalCode.replace(/\s+/g, "");
  if (!/^\d{5}$/.test(clean)) return null;

  if (PAP_API_KEY) {
    try {
      const res = await fetch(
        `https://api.papapi.se/lite/?query=${clean}&format=json&apikey=${PAP_API_KEY}`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (res.ok) {
        const data = await res.json();
        const item = data?.results?.[0];
        if (item?.city) {
          return {
            city: item.city.trim(),
            municipality: item.county?.trim(),
            county: item.state?.trim(),
          };
        }
      }
    } catch { /* fall through */ }
  }
  return null;
}

async function nominatimLookup(
  street: string,
  city: string,
  postalCode?: string
): Promise<NominatimResult | null> {
  if (!NOMINATIM_ENABLED) return null;
  const q = [street, postalCode, city, "Sweden"].filter(Boolean).join(", ");
  try {
    const params = new URLSearchParams({
      q,
      format: "json",
      addressdetails: "1",
      countrycodes: "se",
      limit: "1",
    });
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        signal: AbortSignal.timeout(4000),
        headers: { "User-Agent": "Flytt.io/1.0 (flyttanmalan-assistent)" },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const item = data[0];
    const addr = item.address ?? {};
    return {
      displayName: item.display_name ?? "",
      lat: String(item.lat ?? ""),
      lon: String(item.lon ?? ""),
      type: item.type ?? "",
      addressParts: {
        road: addr.road,
        suburb: addr.suburb ?? addr.neighbourhood ?? addr.quarter,
        city: addr.city ?? addr.town ?? addr.village,
        municipality: addr.municipality ?? addr.county,
        county: addr.state,
        postcode: addr.postcode,
        country: addr.country,
      },
    };
  } catch {
    return null;
  }
}

async function eniroCompanySearch(
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

const CITY_TO_MUNICIPALITY_CODE: Record<string, string> = {
  stockholm: "0180", göteborg: "1480", goteborg: "1480", malmö: "1280",
  malmo: "1280", uppsala: "0380", linköping: "0580", linkoping: "0580",
  västerås: "1980", vasteras: "1980", örebro: "1880", orebro: "1880",
  norrköping: "0581", norrkoping: "0581", helsingborg: "1283", jönköping: "0680",
  jonkoping: "0680", umeå: "2480", umea: "2480", lund: "1281", borås: "1490",
  boras: "1490", sundsvall: "2281", gävle: "2180", gavle: "2180",
  halmstad: "1380", växjö: "0780", vaxjo: "0780", karlstad: "1780",
  luleå: "2580", lulea: "2580", trollhättan: "1488", trollhattan: "1488",
  östersund: "2380", ostersund: "2380", solna: "0184", huddinge: "0126",
  nacka: "0182", täby: "0160", taby: "0160", sollentuna: "0163",
  botkyrka: "0127", haninge: "0136", eskilstuna: "0484", södertälje: "0181",
  sodertalje: "0181", järfälla: "0123", jarfalla: "0123", lidingö: "0186",
  lidingo: "0186", kristianstad: "1290", kalmar: "0880", skellefteå: "2482",
  skelleftea: "2482", karlskrona: "1080", nyköping: "0480", nykoping: "0480",
  varberg: "1383", falun: "2081", uddevalla: "1485", motala: "0583",
  landskrona: "1282", kiruna: "2584",
};

async function scbPopulationLookup(city: string): Promise<ScbPopulation | null> {
  if (!SCB_ENABLED) return null;
  const code = CITY_TO_MUNICIPALITY_CODE[city.toLowerCase().trim()];
  if (!code) return null;

  const cacheKey = `${code}:${SCB_YEAR}:${SCB_TABLE_ID}`;
  const cached = SCB_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < SCB_CACHE_TTL_MS) {
    return cached.data;
  }

  const fetchMetricSum = async (
    contentsCode: "BE0101N1" | "BE0101N2"
  ): Promise<number | null> => {
    const body = JSON.stringify({
      selection: [
        { variableCode: "ContentsCode", valueCodes: [contentsCode] },
        { variableCode: "Tid", valueCodes: [SCB_YEAR] },
        { variableCode: "Region", valueCodes: [code] },
        { variableCode: "Civilstand", valueCodes: ["OG", "G", "SK", "ÄNKL"] },
        { variableCode: "Alder", valueCodes: ["tot"] },
        { variableCode: "Kon", valueCodes: ["1", "2"] },
      ],
    });

    const res = await fetch(
      `https://statistikdatabasen.scb.se/api/v2/tables/${encodeURIComponent(
        SCB_TABLE_ID
      )}/data?lang=sv&outputFormat=json-stat2`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(5500),
      }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const values = Array.isArray((data as any)?.value) ? (data as any).value : [];
    if (values.length === 0) return null;

    let total = 0;
    for (const raw of values) {
      const value = typeof raw === "number" ? raw : Number.parseFloat(String(raw));
      if (Number.isFinite(value)) total += value;
    }
    return Math.round(total);
  };

  try {
    const [population, growth] = await Promise.all([
      fetchMetricSum("BE0101N1"),
      fetchMetricSum("BE0101N2"),
    ]);
    if (population === null) return null;

    const normalized: ScbPopulation = {
      municipality: city,
      population,
      growth: growth ?? 0,
      year: SCB_YEAR,
    };

    SCB_CACHE.set(cacheKey, { data: normalized, ts: Date.now() });
    return normalized;
  } catch {
    return null;
  }
}

function parsePersonalNumber(pnr: string): {
  birthDate: string;
  age: number;
  valid: boolean;
} | null {
  const clean = pnr.replace(/[\s-]/g, "");
  const match = clean.match(/^(\d{4})(\d{2})(\d{2})\d{4}$/);
  if (!match) {
    const short = clean.match(/^(\d{2})(\d{2})(\d{2})\d{4}$/);
    if (!short) return null;
    const year = parseInt(short[1], 10);
    const fullYear = year > 30 ? 1900 + year : 2000 + year;
    const month = short[2];
    const day = short[3];
    const birth = new Date(fullYear, parseInt(month, 10) - 1, parseInt(day, 10));
    const age = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return { birthDate: `${fullYear}-${month}-${day}`, age, valid: age > 0 && age < 130 };
  }
  const [, y, m, d] = match;
  const birth = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
  const age = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return { birthDate: `${y}-${m}-${d}`, age, valid: age > 0 && age < 130 };
}

function getMoveDateInsights(moveDate: string): string[] {
  const insights: string[] = [];
  const move = new Date(moveDate);
  if (isNaN(move.getTime())) return insights;

  const now = new Date();
  const diffDays = Math.ceil((move.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    insights.push(`Flyttdatumet (${moveDate}) har redan passerat for ${Math.abs(diffDays)} dagar sedan.`);
  } else if (diffDays === 0) {
    insights.push("Flyttdatumet ar idag!");
  } else if (diffDays <= 7) {
    insights.push(`Flytten ar om bara ${diffDays} dagar. Prio: adressandring hos Skatteverket, eftersandning post, el pa nya adressen.`);
  } else if (diffDays <= 30) {
    insights.push(`Flytten ar om ${diffDays} dagar (~${Math.ceil(diffDays / 7)} veckor). Bra tid att boka bredband (tar 1-3 veckor) och stadning.`);
  } else {
    insights.push(`Flytten ar om ${diffDays} dagar (~${Math.ceil(diffDays / 30)} manader). God tid for planering.`);
  }
  return insights;
}

import { postalToElArea } from "@/lib/comparison/elarea";

const WEB_SEARCH_COMPARE_ENABLED =
  (process.env.WEB_SEARCH_COMPARE ?? "").trim().toLowerCase() === "y";

const LIVE_TASK_KEYS = [
  "electricity_contract",
  "broadband_order_install",
  "home_insurance",
  "movers_or_trailer",
  "cleaning_service",
];
const STUB_TASK_KEYS = [
  "storage_gap",
  "broadband_tech_check",
  "mail_forwarding",
];

function getComparisonOpportunities(fields: FormFields): string[] {
  const ideas: string[] = [];
  const toCity = typeof fields.toCity === "string" ? fields.toCity.trim() : "";
  const toPostal = typeof fields.toPostal === "string" ? fields.toPostal.trim() : "";
  const hasToAddress = Boolean(fields.toStreet && toPostal && toCity);
  const moveDate = typeof fields.moveDate === "string" ? fields.moveDate.trim() : "";

  const elAreaInfo = toPostal ? postalToElArea(toPostal) : null;
  if (elAreaInfo) {
    ideas.push(
      `Elnatsomrade: ${elAreaInfo.area} (${elAreaInfo.label}, ${elAreaInfo.city}). ` +
      `Nämn detta nar el diskuteras.`
    );
  }

  if (WEB_SEARCH_COMPARE_ENABLED && hasToAddress) {
    const qs = `toPostal=${encodeURIComponent(toPostal)}&toCity=${encodeURIComponent(toCity)}${moveDate ? `&moveDate=${encodeURIComponent(moveDate)}` : ""}`;
    ideas.push(
      `JAMFORELSE-API TILLGANGLIGT (live web search): ` +
      `Erbjud att hamta data nar anvandaren fragar om el, bredband, forsakring, flyttfirma eller stadning. ` +
      `Aktiva endpoints: ` +
      LIVE_TASK_KEYS.map((k) => `GET /api/compare/${k}?${qs}`).join(", ") +
      `. Stubbade (hints only): ${STUB_TASK_KEYS.join(", ")}.`
    );
  }

  if (hasToAddress) {
    ideas.push(
      `Bredband: erbjuda jamforelse for ${toCity} nu. Installation kan ta 1-3 veckor.`
    );
    ideas.push(
      `El: foresla elavtal for ${toCity} innan inflyttning for att undvika dyrt tillsvidarepris.`
    );
    ideas.push(
      `Hemforsakring: ge 2-3 alternativ och rekommendera start senast inflyttningsdatum.`
    );
  }

  if (moveDate) {
    const move = new Date(moveDate);
    if (!isNaN(move.getTime())) {
      const now = new Date();
      const diffDays = Math.ceil(
        (move.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays <= 14) {
        ideas.push(
          "Tidspress: prioritera flyttfirma och stadning med snabb tillgang."
        );
      } else if (diffDays <= 45) {
        ideas.push(
          "God timing: jamfor flyttfirma, forsakring och bredband i samma steg."
        );
      } else if (diffDays > 45) {
        ideas.push(
          "Lang framforhallning: trigga mjuk uppfoljning med stegvis jamforelse over tid."
        );
      }
    }
  }

  if (toCity) {
    ideas.push(
      `Ge lokalt anpassad checklista for ${toCity}: vardcentral, matbutiker, pendling och praktiska flytttips.`
    );
  }

  return ideas;
}

function getEmptyFieldHelp(fields: FormFields): string[] {
  const help: string[] = [];
  const empty = (v: unknown) => !v || (typeof v === "string" && !v.trim());

  if (empty(fields.fromStreet) && empty(fields.fromPostal))
    help.push("Nuvarande adress (fromStreet, fromPostal, fromCity) saknas.");
  if (empty(fields.toStreet) && empty(fields.toPostal))
    help.push("Ny adress (toStreet, toPostal, toCity) saknas helt.");
  if (empty(fields.moveDate))
    help.push("Flyttdatum (moveDate) saknas - kravs for checklista och tidsberakning.");
  if (empty(fields.apartmentNumber) && fields.toStreet)
    help.push("Lagenhetsnummer (apartmentNumber) saknas - behovs for lagenheter, inte villor.");
  if (empty(fields.propertyDesignation))
    help.push("Fastighetsbeteckning saknas - detta ar fastighetens juridiska id (t.ex. 'Rudan Mindre 10'). Hittas pa lantmateriet.se eller i kontraktet.");
  if (empty(fields.propertyOwner))
    help.push("Fastighetsagare saknas - hyresvardens, BRF:ens eller agandets namn.");

  return help;
}

export interface EnrichResult {
  text: string;
  resolvedFields: Record<string, string>;
}

export async function enrichContext(
  formContext: { fields?: FormFields; currentStep?: number } | null
): Promise<EnrichResult> {
  if (!formContext?.fields) return { text: "", resolvedFields: {} };

  const fields = formContext.fields;
  const result: EnrichmentResult = {
    postalLookups: {},
    nominatimResults: [],
    eniroResults: [],
    scbData: null,
    personInsights: [],
    fieldHelp: [],
    moveDateInsights: [],
    comparisonOpportunities: [],
  };

  const lookups: Promise<void>[] = [];

  if (fields.fromPostal) {
    lookups.push(
      lookupPostal(fields.fromPostal).then((r) => {
        if (r) result.postalLookups[fields.fromPostal!] = r;
      })
    );
  }
  if (fields.toPostal && fields.toPostal !== fields.fromPostal) {
    lookups.push(
      lookupPostal(fields.toPostal).then((r) => {
        if (r) result.postalLookups[fields.toPostal!] = r;
      })
    );
  }

  if (fields.toStreet) {
    lookups.push(
      nominatimLookup(fields.toStreet, fields.toCity ?? "", fields.toPostal).then((r) => {
        if (r) result.nominatimResults.push(r);
      })
    );
  }
  if (fields.fromStreet) {
    lookups.push(
      nominatimLookup(fields.fromStreet, fields.fromCity ?? "", fields.fromPostal).then((r) => {
        if (r) result.nominatimResults.push(r);
      })
    );
  }

  if (fields.toCity) {
    const searchTerms = ["matbutik", "vardcentral", "apotek"];
    for (const term of searchTerms) {
      lookups.push(
        eniroCompanySearch(term, fields.toCity).then((r) => {
          result.eniroResults.push(...r);
        })
      );
    }

    lookups.push(
      scbPopulationLookup(fields.toCity).then((r) => {
        result.scbData = r;
      })
    );
  }

  await Promise.all(lookups);

  if (fields.personalNumber) {
    const parsed = parsePersonalNumber(fields.personalNumber);
    if (parsed?.valid) {
      result.personInsights.push(
        `Personnumret tillhor nagon fodd ${parsed.birthDate} (${parsed.age} ar).`
      );
    }
  }

  if (fields.moveDate) {
    result.moveDateInsights = getMoveDateInsights(fields.moveDate);
  }

  result.comparisonOpportunities = getComparisonOpportunities(fields);
  result.fieldHelp = getEmptyFieldHelp(fields);

  const sections: string[] = [];

  if (Object.keys(result.postalLookups).length > 0) {
    const lines = Object.entries(result.postalLookups).map(
      ([postal, data]) =>
        `  ${postal} → ${data.city}${data.municipality ? ` (${data.municipality}, ${data.county})` : ""}`
    );
    sections.push("## Postnummeruppslag (PAP API)\n" + lines.join("\n"));
  }

  if (result.nominatimResults.length > 0) {
    const lines = result.nominatimResults.map((r) => {
      const parts: string[] = [`  ${r.displayName}`];
      parts.push(`    Koordinater: ${r.lat}, ${r.lon}`);
      if (r.addressParts.suburb) parts.push(`    Stadsdel: ${r.addressParts.suburb}`);
      if (r.addressParts.municipality) parts.push(`    Kommun: ${r.addressParts.municipality}`);
      if (r.addressParts.county) parts.push(`    Lan: ${r.addressParts.county}`);
      if (r.addressParts.postcode) parts.push(`    Postnummer: ${r.addressParts.postcode}`);
      return parts.join("\n");
    });
    sections.push(
      "## Adressvalidering (OpenStreetMap/Nominatim)\n" + lines.join("\n\n")
    );
  }

  if (result.eniroResults.length > 0) {
    const lines = result.eniroResults.map(
      (r) =>
        `  ${r.title}${r.address ? ` — ${r.address}` : ""}${r.city ? `, ${r.zipCode} ${r.city}` : ""}${r.phoneNumber ? ` (tel: ${r.phoneNumber})` : ""}`
    );
    sections.push(
      "## Narheten (Eniro foretagssok, baserat pa toCity)\n" +
      "Matbutiker, vardcentraler och apotek nara nya adressen:\n" +
      lines.join("\n")
    );
  }

  if (result.scbData) {
    const s = result.scbData;
    const growthStr = s.growth >= 0 ? `+${s.growth}` : String(s.growth);
    sections.push(
      `## Befolkningsdata (SCB, ${s.year})\n` +
      `  ${s.municipality}: ${s.population.toLocaleString("sv-SE")} invanare (forandring: ${growthStr})`
    );
  }

  if (result.personInsights.length > 0) {
    sections.push("## Personinsikter\n" + result.personInsights.join("\n"));
  }

  if (result.moveDateInsights.length > 0) {
    sections.push("## Flyttdatum-analys\n" + result.moveDateInsights.join("\n"));
  }

  if (result.fieldHelp.length > 0) {
    sections.push(
      "## Saknade falt (du kan hjalpa med)\n" + result.fieldHelp.join("\n")
    );
  }

  if (result.comparisonOpportunities.length > 0) {
    sections.push(
      "## Proaktiv jamforelse (nasta basta steg)\n" +
        result.comparisonOpportunities.join("\n")
    );
  }

  const resolvedFields: Record<string, string> = {};
  const autoFilled: string[] = [];

  if (!fields.toPostal && fields.toStreet) {
    const toNom = result.nominatimResults.find((r) => r.addressParts.postcode);
    if (toNom?.addressParts.postcode) {
      resolvedFields.toPostal = toNom.addressParts.postcode.replace(/\s+/g, "");
      autoFilled.push(`toPostal=${resolvedFields.toPostal} (fran Nominatim)`);
    }
    if (!fields.toCity && toNom?.addressParts.city) {
      resolvedFields.toCity = toNom.addressParts.city;
      autoFilled.push(`toCity=${toNom.addressParts.city} (fran Nominatim)`);
    }
  }

  if (!fields.fromPostal && fields.fromStreet) {
    const fromNom = result.nominatimResults.find(
      (r) =>
        r.addressParts.postcode &&
        (!fields.fromCity || r.displayName.toLowerCase().includes(fields.fromCity.toLowerCase())),
    );
    if (fromNom?.addressParts.postcode) {
      resolvedFields.fromPostal = fromNom.addressParts.postcode.replace(/\s+/g, "");
      autoFilled.push(`fromPostal=${resolvedFields.fromPostal} (fran Nominatim)`);
    }
    if (!fields.fromCity && fromNom?.addressParts.city) {
      resolvedFields.fromCity = fromNom.addressParts.city;
      autoFilled.push(`fromCity=${fromNom.addressParts.city} (fran Nominatim)`);
    }
  }

  if (fields.toPostal || resolvedFields.toPostal) {
    const postal = fields.toPostal || resolvedFields.toPostal;
    const lookup = result.postalLookups[postal!];
    if (lookup?.city && !fields.toCity) {
      resolvedFields.toCity = lookup.city;
      autoFilled.push(`toCity=${lookup.city} (fran PAP)`);
    }
  }

  if (fields.fromPostal || resolvedFields.fromPostal) {
    const postal = fields.fromPostal || resolvedFields.fromPostal;
    const lookup = result.postalLookups[postal!];
    if (lookup?.city && !fields.fromCity) {
      resolvedFields.fromCity = lookup.city;
      autoFilled.push(`fromCity=${lookup.city} (fran PAP)`);
    }
  }

  const postalFollowups: Promise<void>[] = [];

  if (resolvedFields.toPostal && !fields.toPostal) {
    postalFollowups.push(
      lookupPostal(resolvedFields.toPostal).then((newLookup) => {
        if (!newLookup) return;
        result.postalLookups[resolvedFields.toPostal] = newLookup;
        if (!fields.toCity && !resolvedFields.toCity && newLookup.city) {
          resolvedFields.toCity = newLookup.city;
          autoFilled.push(`toCity=${newLookup.city} (fran PAP via auto-postal)`);
        }
      }),
    );
  }

  if (resolvedFields.fromPostal && !fields.fromPostal) {
    postalFollowups.push(
      lookupPostal(resolvedFields.fromPostal).then((newLookup) => {
        if (!newLookup) return;
        result.postalLookups[resolvedFields.fromPostal] = newLookup;
        if (!fields.fromCity && !resolvedFields.fromCity && newLookup.city) {
          resolvedFields.fromCity = newLookup.city;
          autoFilled.push(`fromCity=${newLookup.city} (fran PAP via auto-postal)`);
        }
      }),
    );
  }

  await Promise.all(postalFollowups);

  if (autoFilled.length > 0) {
    sections.push(
      "## Auto-ifyllda falt (systemet har slagit upp dessa)\n" +
      "Foljande falt saknades i formularet men har automatiskt slagits upp:\n" +
      autoFilled.map((f) => `  - ${f}`).join("\n") + "\n" +
      "Anvand dessa varden direkt. Fraga INTE anvandaren om dem — de ar redan kanda. " +
      "Inkludera dem i suggestion-block om anvandaren ber om hjalp med formularet.",
    );
  }

  if (sections.length === 0) return { text: "", resolvedFields };
  return {
    text: "\n\n## Uppslagna data (fran Flytt.io APIer)\n\n" + sections.join("\n\n"),
    resolvedFields,
  };
}

export const FIELD_KNOWLEDGE = `
## Faltforklaringar (anvand nar anvandaren fragar vad ett falt betyder)

- **Fastighetsbeteckning**: Fastighetens unika juridiska id i Sverige. Format: "Omrade Nummer" t.ex. "Rudan Mindre 10" eller "Lunden 5:12". Hittas i kopeavtal, lagfartsbevis, eller pa lantmateriet.se. Behovs for Skatteverkets flyttanmalan om man flyttar till villa/radhus.
- **Fastighetsagare**: Vem som ager fastigheten. For hyresratt: hyresvarden (t.ex. "Stockholmshem"). For BRF: foreningens namn (t.ex. "BRF Solsidan"). For villa: "Egen" eller agaren.
- **Lagenhetsnummer**: 4-siffrigt nummer som identifierar lagenheten i fastigheten. Format: XXYY dar XX = vaningsplan, YY = dorrens position fran vanster. T.ex. "1302" = vaning 13, dorr 02. Hittas pa dorren, i hyreskontraktet, eller via fastighetsagaren. Behovs INTE for villor.
- **Personnummer**: Svenskt personnummer i formatet YYYYMMDD-XXXX. De fyra sista siffrorna ar fodelsedistrikt + kon + kontrollsiffra. Behovs for folkbokforing.
- **Postnummer**: 5 siffror (XXX XX). Kopplar till en ort via Postnord/PAP. Systemet slar automatiskt upp orten.
- **Inflyttningsdatum**: Datumet du faktiskt flyttar in i din nya bostad. Skatteverket kraver anmalan senast en vecka efter inflytt. Checklistan baseras pa detta datum.
`;
