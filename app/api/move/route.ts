import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { users, moves, checklistItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function encodeHints(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const normalized = value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return normalized.length > 0 ? JSON.stringify(normalized) : null;
}

function decodeHints(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => typeof item === "string");
  } catch {
    return [];
  }
}

const PAP_API_KEY = process.env.PAP_API_KEY ?? "";
const NOMINATIM_ENABLED =
  (process.env.NOMINATIM_ENABLED ?? "true").trim().toLowerCase() !== "false";
const ENIRO_API_KEY = process.env.ENIRO_API_KEY ?? "";
const SCB_ENABLED =
  (process.env.SCB_ENABLED ?? "false").trim().toLowerCase() === "y" ||
  (process.env.SCB_ENABLED ?? "false").trim().toLowerCase() === "true";
const SCB_YEAR = (process.env.SCB_YEAR ?? "2024").trim();
const SCB_TABLE_ID = (process.env.SCB_TABLE_ID ?? "TAB638").trim();

interface PostalResult {
  city: string;
  municipality?: string;
  county?: string;
  latitude?: string;
  longitude?: string;
}

async function papLookup(postalCode: string): Promise<PostalResult | null> {
  const clean = postalCode.replace(/\s+/g, "");
  if (!/^\d{5}$/.test(clean) || !PAP_API_KEY) return null;
  try {
    const res = await fetch(
      `https://api.papapi.se/lite/?query=${clean}&format=json&apikey=${PAP_API_KEY}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.results?.[0];
    if (!item?.city) return null;
    return {
      city: (item.city ?? "").trim(),
      municipality: (item.county ?? "").trim(),
      county: (item.state ?? "").trim(),
      latitude: String(item.latitude ?? ""),
      longitude: String(item.longitude ?? ""),
    };
  } catch {
    return null;
  }
}

async function nominatimLookup(
  street: string,
  city: string,
  postalCode?: string
): Promise<{ lat: string; lon: string; municipality?: string; county?: string; displayName: string } | null> {
  if (!NOMINATIM_ENABLED || !street) return null;
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
        headers: { "User-Agent": "Flytt.io/1.0 (flyttanmalan)" },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const item = data[0];
    const addr = item.address ?? {};
    return {
      lat: String(item.lat ?? ""),
      lon: String(item.lon ?? ""),
      municipality: addr.municipality ?? addr.county ?? "",
      county: addr.state ?? "",
      displayName: item.display_name ?? "",
    };
  } catch {
    return null;
  }
}

async function ipGeoLookup(ip: string): Promise<{
  city: string;
  region: string;
  country: string;
  lat: string;
  lon: string;
} | null> {
  if (!ip) return null;
  const cleanIp = ip.split(",")[0].trim();
  if (!cleanIp || cleanIp === "127.0.0.1" || cleanIp === "::1") return null;
  try {
    const res = await fetch(
      `http://ip-api.com/json/${cleanIp}?fields=status,city,regionName,country,lat,lon`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "success") return null;
    return {
      city: data.city ?? "",
      region: data.regionName ?? "",
      country: data.country ?? "",
      lat: String(data.lat ?? ""),
      lon: String(data.lon ?? ""),
    };
  } catch {
    return null;
  }
}

async function eniroSearch(
  query: string,
  geoArea?: string
): Promise<Record<string, unknown>[]> {
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
  stockholm: "0180", göteborg: "1480", malmö: "1280", uppsala: "0380",
  linköping: "0580", västerås: "1980", örebro: "1880", norrköping: "0581",
  helsingborg: "1283", jönköping: "0680", umeå: "2480", lund: "1281",
  borås: "1490", sundsvall: "2281", gävle: "2180", halmstad: "1380",
  växjö: "0780", karlstad: "1780", luleå: "2580", östersund: "2380",
  solna: "0184", huddinge: "0126", nacka: "0182", täby: "0160",
};

async function scbPopulationLookup(city: string): Promise<{
  municipality: string;
  population: number;
  growth: number;
  year: string;
} | null> {
  if (!SCB_ENABLED || !city) return null;
  const code = CITY_TO_MUNICIPALITY_CODE[city.toLowerCase().trim()];
  if (!code) return null;
  try {
    const body = JSON.stringify({
      selection: [
        { variableCode: "ContentsCode", valueCodes: ["BE0101N1"] },
        { variableCode: "Tid", valueCodes: [SCB_YEAR] },
        { variableCode: "Region", valueCodes: [code] },
        { variableCode: "Civilstand", valueCodes: ["OG", "G", "SK", "ÄNKL"] },
        { variableCode: "Alder", valueCodes: ["tot"] },
        { variableCode: "Kon", valueCodes: ["1", "2"] },
      ],
    });
    const res = await fetch(
      `https://statistikdatabasen.scb.se/api/v2/tables/${encodeURIComponent(SCB_TABLE_ID)}/data?lang=sv&outputFormat=json-stat2`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const values = Array.isArray((data as Record<string, unknown>)?.value) ? (data as Record<string, unknown[]>).value : [];
    let total = 0;
    for (const raw of values) {
      const v = typeof raw === "number" ? raw : Number.parseFloat(String(raw));
      if (Number.isFinite(v)) total += v;
    }
    if (total === 0) return null;
    return { municipality: city, population: Math.round(total), growth: 0, year: SCB_YEAR };
  } catch {
    return null;
  }
}

async function runEnrichment(moveId: number, opts: {
  fromPostal?: string;
  fromStreet?: string;
  fromCity?: string;
  toPostal?: string;
  toStreet?: string;
  toCity?: string;
  ipAddress?: string | null;
}) {
  const db = getDb();
  const enrichment: Record<string, unknown> = {};
  const updateFields: Record<string, unknown> = {};

  const tasks: Promise<void>[] = [];

  if (opts.fromPostal) {
    tasks.push(
      papLookup(opts.fromPostal).then((r) => {
        if (!r) return;
        enrichment.fromPostalPap = r;
        updateFields.fromMunicipality = r.municipality || null;
        updateFields.fromCounty = r.county || null;
        if (r.latitude) updateFields.fromLatitude = r.latitude;
        if (r.longitude) updateFields.fromLongitude = r.longitude;
      })
    );
  }

  if (opts.toPostal) {
    tasks.push(
      papLookup(opts.toPostal).then((r) => {
        if (!r) return;
        enrichment.toPostalPap = r;
        updateFields.toMunicipality = r.municipality || null;
        updateFields.toCounty = r.county || null;
        if (r.latitude) updateFields.toLatitude = r.latitude;
        if (r.longitude) updateFields.toLongitude = r.longitude;
      })
    );
  }

  if (opts.fromStreet) {
    tasks.push(
      nominatimLookup(opts.fromStreet, opts.fromCity ?? "", opts.fromPostal).then((r) => {
        if (!r) return;
        enrichment.fromNominatim = r;
        if (!updateFields.fromLatitude && r.lat) updateFields.fromLatitude = r.lat;
        if (!updateFields.fromLongitude && r.lon) updateFields.fromLongitude = r.lon;
        if (!updateFields.fromMunicipality && r.municipality) updateFields.fromMunicipality = r.municipality;
        if (!updateFields.fromCounty && r.county) updateFields.fromCounty = r.county;
      })
    );
  }

  if (opts.toStreet) {
    tasks.push(
      nominatimLookup(opts.toStreet, opts.toCity ?? "", opts.toPostal).then((r) => {
        if (!r) return;
        enrichment.toNominatim = r;
        if (!updateFields.toLatitude && r.lat) updateFields.toLatitude = r.lat;
        if (!updateFields.toLongitude && r.lon) updateFields.toLongitude = r.lon;
        if (!updateFields.toMunicipality && r.municipality) updateFields.toMunicipality = r.municipality;
        if (!updateFields.toCounty && r.county) updateFields.toCounty = r.county;
      })
    );
  }

  if (opts.ipAddress) {
    tasks.push(
      ipGeoLookup(opts.ipAddress).then((r) => {
        if (!r) return;
        enrichment.ipGeo = r;
        updateFields.ipCity = r.city;
        updateFields.ipRegion = r.region;
        updateFields.ipCountry = r.country;
        updateFields.ipLatitude = r.lat;
        updateFields.ipLongitude = r.lon;
      })
    );
  }

  if (opts.toCity) {
    const searchTerms = ["matbutik", "vårdcentral", "apotek"];
    for (const term of searchTerms) {
      tasks.push(
        eniroSearch(term, opts.toCity).then((r) => {
          if (r.length > 0) {
            if (!enrichment.eniro) enrichment.eniro = {};
            (enrichment.eniro as Record<string, unknown>)[term] = r;
          }
        })
      );
    }

    tasks.push(
      scbPopulationLookup(opts.toCity).then((r) => {
        if (r) enrichment.scb = r;
      })
    );
  }

  await Promise.all(tasks);

  updateFields.enrichmentData = JSON.stringify(enrichment);

  if (Object.keys(updateFields).length > 0) {
    await db.update(moves).set(updateFields).where(eq(moves.id, moveId));
  }
}

// POST /api/move – Create a new move (and user if needed)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      firstName,
      lastName,
      personalNumber,
      email,
      phone,
      fromStreet,
      fromPostal,
      fromCity,
      toStreet,
      toPostal,
      toCity,
      apartmentNumber,
      propertyDesignation,
      propertyOwner,
      moveDate,
      householdType,
      reason,
      hasChildren,
      checklist,
    } = body;

    const ipAddress =
      req.headers.get("x-forwarded-for") ??
      req.headers.get("x-real-ip") ??
      null;

    const userAgent = req.headers.get("user-agent") ?? null;

    const resolvedName = name || [firstName, lastName].filter(Boolean).join(" ").trim();

    if (!resolvedName || !toStreet || !moveDate) {
      return NextResponse.json(
        { error: "name, toStreet, and moveDate are required" },
        { status: 400 }
      );
    }

    const db = getDb();

    const [userResult] = await db
      .insert(users)
      .values({
        name: resolvedName,
        firstName: firstName || null,
        lastName: lastName || null,
        personalNumber: personalNumber || null,
        email: email || null,
        phone: phone || null,
      })
      .returning();

    const [moveResult] = await db
      .insert(moves)
      .values({
        userId: userResult.id,
        fromStreet: fromStreet || null,
        fromPostal: fromPostal || null,
        fromCity: fromCity || null,
        toStreet,
        toPostal: toPostal || null,
        toCity: toCity || null,
        apartmentNumber: apartmentNumber || null,
        propertyDesignation: propertyDesignation || null,
        propertyOwner: propertyOwner || null,
        moveDate,
        householdType: householdType || null,
        reason: reason || null,
        hasChildren: hasChildren === true,
        status: "submitted",
        ipAddress,
        userAgent,
      })
      .returning();

    // Save checklist items if provided
    if (checklist && Array.isArray(checklist) && checklist.length > 0) {
      for (const item of checklist) {
        const fallbackTitle =
          typeof item?.taskKey === "string" ? item.taskKey : "Checklist item";
        await db.insert(checklistItems)
          .values({
            moveId: moveResult.id,
            taskKey: item.taskKey || null,
            sectionKey: item.sectionKey || null,
            section: item.section || null,
            title: item.title || fallbackTitle,
            description: item.description || null,
            dueDate: item.dueDate || null,
            completed: item.completed === true,
            needHelp: item.needHelp === true,
            wantCompare: item.wantCompare === true,
            status:
              item.status === "in_progress" || item.status === "done"
                ? item.status
                : "todo",
            comparisonHints: encodeHints(item.comparisonHints),
            category: item.category || null,
            sortOrder: item.sortOrder || 0,
          });
      }
    }

    // Fire-and-forget: enrich the move with external API data
    runEnrichment(moveResult.id, {
      fromPostal: fromPostal || undefined,
      fromStreet: fromStreet || undefined,
      fromCity: fromCity || undefined,
      toPostal: toPostal || undefined,
      toStreet: toStreet || undefined,
      toCity: toCity || undefined,
      ipAddress,
    }).catch((err) => console.error("[move/enrich] Error:", err));

    return NextResponse.json({
      success: true,
      moveId: moveResult.id,
      userId: userResult.id,
      status: moveResult.status,
    });
  } catch (error) {
    console.error("Move create error:", error);
    const isConfigError =
      error instanceof Error &&
      error.message.includes("TURSO_DATABASE_URL");
    return NextResponse.json(
      {
        error: isConfigError
          ? "Database is not configured. Set TURSO_DATABASE_URL."
          : "Failed to create move",
      },
      { status: isConfigError ? 503 : 500 }
    );
  }
}

// GET /api/move?id=X – Get a move by ID
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id parameter is required" },
        { status: 400 }
      );
    }

    const db = getDb();

    const moveId = parseInt(id, 10);
    if (isNaN(moveId)) {
      return NextResponse.json(
        { error: "Invalid id parameter" },
        { status: 400 }
      );
    }

    const [move] = await db
      .select()
      .from(moves)
      .where(eq(moves.id, moveId))
      .limit(1);

    if (!move) {
      return NextResponse.json({ error: "Move not found" }, { status: 404 });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, move.userId))
      .limit(1);

    const rawItems = await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.moveId, move.id));

    const items = rawItems.map((item) => ({
      ...item,
      comparisonHints: decodeHints(item.comparisonHints),
    }));

    return NextResponse.json({ move, user, checklist: items });
  } catch (error) {
    console.error("Move get error:", error);
    const isConfigError =
      error instanceof Error &&
      error.message.includes("TURSO_DATABASE_URL");
    return NextResponse.json(
      {
        error: isConfigError
          ? "Database is not configured. Set TURSO_DATABASE_URL."
          : "Failed to get move",
      },
      { status: isConfigError ? 503 : 500 }
    );
  }
}
