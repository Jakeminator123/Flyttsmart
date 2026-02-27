import { NextResponse } from "next/server";
import {
  addOpenClawEvent,
  listOpenClawEvents,
  type OpenClawEventLevel,
} from "@/lib/admin/openclaw-events";

export const dynamic = "force-dynamic";

function isValidLevel(level: string): level is OpenClawEventLevel {
  return level === "info" || level === "warning" || level === "error";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limitRaw = Number(searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 50;

  return NextResponse.json({
    events: listOpenClawEvents(limit),
  });
}

export async function POST(request: Request) {
  const expectedToken = (process.env.OPENCLAW_ADMIN_EVENTS_TOKEN ?? "").trim();
  if (expectedToken) {
    const providedToken =
      request.headers.get("x-openclaw-admin-events-token")?.trim() ?? "";
    if (!providedToken || providedToken !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const body = await request.json();
    const level = String(body.level ?? "info").toLowerCase();
    const message = String(body.message ?? "").trim();
    const source = String(body.source ?? "openclaw").trim();
    const details =
      body.details === undefined ? undefined : String(body.details).trim();

    if (!isValidLevel(level)) {
      return NextResponse.json(
        { error: "Invalid level. Use info|warning|error." },
        { status: 400 }
      );
    }
    if (!message) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    const event = addOpenClawEvent({
      level,
      source,
      message,
      details,
    });

    return NextResponse.json({ ok: true, event });
  } catch (error) {
    console.error("[admin/openclaw/events] POST error:", error);
    return NextResponse.json(
      { error: "Failed to store event" },
      { status: 500 }
    );
  }
}
