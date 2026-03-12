import { NextRequest, NextResponse } from "next/server";
import { normalizePersonalNumber } from "@/lib/personal-number";

export const maxDuration = 60;

const RATSIT_SCRAPER_URL =
  process.env.RATSIT_SCRAPER_URL ?? "http://localhost:8766";

const ENRICH_API_SECRET = (process.env.ENRICH_API_SECRET ?? "").trim();

const ALLOWED_ORIGINS = [
  "https://flyttanu.vercel.app",
  "https://flytta.nu",
  "https://www.flytta.nu",
  "http://localhost:4173",
  "http://localhost:3000",
];

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization") ?? "";
  if (ENRICH_API_SECRET && authHeader === `Bearer ${ENRICH_API_SECRET}`) {
    return true;
  }

  const origin = req.headers.get("origin") ?? "";
  const referer = req.headers.get("referer") ?? "";
  if (origin && ALLOWED_ORIGINS.includes(origin)) return true;
  if (referer && ALLOWED_ORIGINS.some((o) => referer.startsWith(o))) return true;

  if (process.env.NODE_ENV === "development") return true;

  return false;
}

function resolveConfidence(fields: {
  firstName?: string;
  lastName?: string;
  fromStreet?: string;
  fromCity?: string;
  fromPostal?: string | null;
}) {
  const score = [
    fields.firstName,
    fields.lastName,
    fields.fromStreet,
    fields.fromCity,
    fields.fromPostal,
  ].filter(Boolean).length;

  if (score >= 4) return "high" as const;
  if (score >= 2) return "medium" as const;
  return "low" as const;
}

/** POST /api/enrich/person — personnummer lookup via rats_meri_docker_scraper */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const pnr = normalizePersonalNumber(
      body?.personalNumber ?? body?.pnr ?? body?.personnummer ?? "",
    );
    if (!pnr) {
      return NextResponse.json(
        { error: "personnummer krävs (giltigt svenskt personnummer)" },
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
        source: "rats_meri_docker_scraper",
        confidence: "low",
        missing: ["firstName", "lastName", "fromStreet", "fromCity", "fromPostal"],
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
      personnummer?: string;
    };

    const firstName =
      data.givenName || data.firstName || data.name?.split(" ")[0] || "";
    const lastName =
      data.lastName || data.name?.split(" ").slice(1).join(" ") || "";
    const fromStreet =
      data.streetAddress || data.address?.split(",")[0]?.trim() || "";
    const fromCity = data.city?.trim() || "";
    const fromPostal = null;
    const missing = [
      !firstName ? "firstName" : null,
      !lastName ? "lastName" : null,
      !fromStreet ? "fromStreet" : null,
      !fromCity ? "fromCity" : null,
      !fromPostal ? "fromPostal" : null,
    ].filter((value): value is string => Boolean(value));

    return NextResponse.json({
      found: true,
      source: "rats_meri_docker_scraper",
      confidence: resolveConfidence({
        firstName,
        lastName,
        fromStreet,
        fromCity,
        fromPostal,
      }),
      displayName: data.name || [firstName, lastName].filter(Boolean).join(" "),
      missing,
      firstName,
      lastName,
      personalNumber: data.personnummer || pnr,
      fromStreet,
      fromCity,
      fromPostal,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[enrich/person]", msg);
    return NextResponse.json(
      {
        found: false,
        source: "rats_meri_docker_scraper",
        confidence: "low",
        missing: ["firstName", "lastName", "fromStreet", "fromCity", "fromPostal"],
        error: "Personuppslag misslyckades",
        details: msg,
      },
      { status: 500 }
    );
  }
}
