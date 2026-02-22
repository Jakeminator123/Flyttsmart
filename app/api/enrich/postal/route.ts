import { NextResponse } from "next/server";

const PAP_API_KEY = process.env.PAP_API_KEY ?? "";

const FALLBACK: Record<string, string> = {
  "111": "Stockholm", "113": "Stockholm", "114": "Stockholm", "115": "Stockholm",
  "116": "Stockholm", "117": "Stockholm", "118": "Stockholm", "119": "Stockholm",
  "120": "Årsta", "121": "Johanneshov", "122": "Enskede", "123": "Farsta",
  "124": "Bandhagen", "125": "Älvsjö", "126": "Hägersten", "127": "Skärholmen",
  "131": "Nacka", "141": "Huddinge", "161": "Bromma", "171": "Solna",
  "172": "Sundbyberg", "175": "Järfälla", "181": "Lidingö", "183": "Täby",
  "211": "Malmö", "212": "Malmö", "213": "Malmö", "214": "Malmö",
  "221": "Lund", "222": "Lund", "231": "Helsingborg",
  "411": "Göteborg", "412": "Göteborg", "413": "Göteborg", "414": "Göteborg",
  "415": "Göteborg", "416": "Göteborg", "431": "Mölndal", "433": "Partille",
  "502": "Borås", "531": "Lidköping", "541": "Skövde",
  "582": "Linköping", "583": "Linköping", "602": "Norrköping",
  "632": "Eskilstuna", "702": "Örebro", "721": "Västerås",
  "752": "Uppsala", "753": "Uppsala", "754": "Uppsala",
  "802": "Gävle", "831": "Östersund", "852": "Sundsvall",
  "903": "Umeå", "951": "Luleå", "961": "Boden", "971": "Luleå",
  "972": "Luleå", "981": "Kiruna",
};

function fallbackLookup(postalCode: string): string | null {
  const prefix = postalCode.slice(0, 3);
  return FALLBACK[prefix] ?? null;
}

interface PapResult {
  city: string;
  county: string;
  state: string;
  latitude: string;
  longitude: string;
}

async function papLookup(postalCode: string): Promise<PapResult | null> {
  if (!PAP_API_KEY) return null;

  const url = `https://api.papapi.se/lite/?query=${postalCode}&format=json&apikey=${PAP_API_KEY}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;

    const data = await res.json();
    const results = data?.results;
    if (!Array.isArray(results) || results.length === 0) return null;

    const item = results[0];
    return {
      city: (item.city ?? "").trim(),
      county: (item.county ?? "").trim(),
      state: (item.state ?? "").trim(),
      latitude: String(item.latitude ?? ""),
      longitude: String(item.longitude ?? ""),
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const postalCode = (searchParams.get("postalCode") ?? "").replace(/\s+/g, "");

  if (!/^\d{5}$/.test(postalCode)) {
    return NextResponse.json(
      { error: "postalCode must be exactly 5 digits" },
      { status: 400 },
    );
  }

  const pap = await papLookup(postalCode);
  if (pap && pap.city) {
    return NextResponse.json({
      city: pap.city,
      municipality: pap.county,
      county: pap.state,
      latitude: pap.latitude,
      longitude: pap.longitude,
      source: "pap",
    });
  }

  const city = fallbackLookup(postalCode);
  if (city) {
    return NextResponse.json({
      city,
      municipality: null,
      county: null,
      latitude: null,
      longitude: null,
      source: "fallback",
    });
  }

  return NextResponse.json(
    { error: "No city found for this postal code" },
    { status: 404 },
  );
}
