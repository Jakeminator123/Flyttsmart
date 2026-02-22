import { NextRequest, NextResponse } from "next/server";
import { buildNormalizedSkvPayload, type SkvSourceData } from "@/lib/skv/payload";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SkvSourceData;
    const payload = buildNormalizedSkvPayload(body || {});
    return NextResponse.json({ ok: true, payload });
  } catch (error) {
    console.error("[SKV payload] failed:", error);
    return NextResponse.json({ ok: false, error: "Invalid payload body" }, { status: 400 });
  }
}
