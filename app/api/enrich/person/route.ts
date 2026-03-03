import { NextRequest, NextResponse } from "next/server";

const RATSIT_SCRAPER_URL =
  process.env.RATSIT_SCRAPER_URL ?? "http://localhost:8766";

function normalizePnr(v: string): string | null {
  const s = String(v || "").replace(/\s|-/g, "");
  if (/^\d{12}$/.test(s)) return `${s.slice(0, 8)}-${s.slice(8)}`;
  return null;
}

/** POST /api/enrich/person — personnummer lookup via rats_meri_docker_scraper */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pnr = normalizePnr(body?.personalNumber ?? body?.pnr ?? body?.personnummer ?? "");
    if (!pnr) {
      return NextResponse.json(
        { error: "personnummer krävs (12 siffror, format YYYYMMDD-NNNN)" },
        { status: 400 }
      );
    }

    const res = await fetch(`${RATSIT_SCRAPER_URL}/lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pnr }),
      signal: AbortSignal.timeout(45000),
    });

    if (res.status === 404) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json({
        found: false,
        error: data?.error ?? "Person hittades inte",
      });
    }

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: text || `Scraper error ${res.status}` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      name?: string;
      givenName?: string;
      firstName?: string;
      lastName?: string;
      address?: string;
      streetAddress?: string;
      city?: string;
      age?: number;
      gender?: string;
      personnummer?: string;
      married?: boolean;
      hasCompany?: boolean;
      coordinates?: { lat?: number; lng?: number };
      medboende?: Array<{ name?: string; age?: number }>;
      fordonAdress?: unknown[];
    };

    return NextResponse.json({
      found: true,
      firstName: data.givenName || data.firstName || (data.name?.split(" ")[0]),
      lastName: data.lastName || data.name?.split(" ").slice(1).join(" "),
      personalNumber: data.personnummer || pnr,
      fromStreet: data.streetAddress || data.address?.split(",")[0]?.trim(),
      fromCity: data.city,
      fromPostal: null,
      age: data.age,
      gender: data.gender,
      address: data.address,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[enrich/person]", msg);
    return NextResponse.json(
      { error: "Personuppslag misslyckades", details: msg },
      { status: 500 }
    );
  }
}
