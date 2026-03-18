import { NextResponse } from "next/server";
import { count, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { reminderLogs } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const MAX_LOOKAHEAD_DAYS = 30;

function parseBoolean(input: unknown, fallback: boolean): boolean {
  if (typeof input === "boolean") return input;
  if (typeof input === "string") {
    const normalized = input.trim().toLowerCase();
    if (["1", "true", "y", "yes"].includes(normalized)) return true;
    if (["0", "false", "n", "no"].includes(normalized)) return false;
  }
  return fallback;
}

function parseBooleanString(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "y", "yes"].includes(normalized)) return true;
  if (["0", "false", "n", "no"].includes(normalized)) return false;
  return undefined;
}

function getDefaultLookaheadDays(): number {
  const parsed = Number(process.env.REMINDER_DEFAULT_LOOKAHEAD_DAYS ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0) return 3;
  return Math.min(Math.floor(parsed), MAX_LOOKAHEAD_DAYS);
}

function getDefaultDryRun(): boolean {
  const fromEnv = parseBooleanString(process.env.REMINDER_DEFAULT_DRY_RUN);
  if (typeof fromEnv === "boolean") return fromEnv;
  return process.env.NODE_ENV !== "production";
}

function getDefaultUseAida(): boolean {
  const fromEnv = parseBooleanString(process.env.REMINDER_USE_AIDA);
  if (typeof fromEnv === "boolean") return fromEnv;
  return true;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (!trimmed.includes("@")) return null;
  return trimmed;
}

function parseLookahead(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return getDefaultLookaheadDays();
  return Math.min(Math.floor(parsed), MAX_LOOKAHEAD_DAYS);
}

function normalizeProvider(value: unknown): "auto" | "resend" | "sendgrid" {
  if (typeof value !== "string") return "auto";
  const normalized = value.trim().toLowerCase();
  if (normalized === "resend") return "resend";
  if (normalized === "sendgrid") return "sendgrid";
  return "auto";
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

export async function GET() {
  try {
    const db = getDb();
    const [total] = await db.select({ value: count() }).from(reminderLogs);
    const [today] = await db
      .select({ value: count() })
      .from(reminderLogs)
      .where(eq(reminderLogs.scheduledFor, todayIso()));

    const recent = await db
      .select({
        id: reminderLogs.id,
        moveId: reminderLogs.moveId,
        scheduledFor: reminderLogs.scheduledFor,
        emailTo: reminderLogs.emailTo,
        provider: reminderLogs.provider,
        subject: reminderLogs.subject,
        providerMessageId: reminderLogs.providerMessageId,
        createdAt: reminderLogs.createdAt,
      })
      .from(reminderLogs)
      .orderBy(sql`${reminderLogs.createdAt} DESC`)
      .limit(20);

    const cronSecret =
      (process.env.CRON_SECRET ?? "").trim() ||
      (process.env.VERCEL_CRON_SECRET ?? "").trim();

    return NextResponse.json({
      cronAuthConfigured: Boolean(cronSecret),
      defaults: {
        providerPreference:
          (process.env.REMINDER_EMAIL_PROVIDER || "auto").trim() || "auto",
        fromEmail:
          (process.env.REMINDER_EMAIL_FROM || process.env.EMAIL_FROM || "")
            .trim() || null,
        useAida:
          getDefaultUseAida(),
        dryRunDefault: getDefaultDryRun(),
        lookaheadDays: getDefaultLookaheadDays(),
      },
      integrations: {
        hasResendApiKey: Boolean((process.env.RESEND_API_KEY ?? "").trim()),
        hasSendgridApiKey: Boolean((process.env.SENDGRID_API_KEY ?? "").trim()),
      },
      stats: {
        totalReminderLogs: total.value,
        todayReminderLogs: today.value,
      },
      recentLogs: recent,
    });
  } catch (error) {
    console.error("[admin/openclaw/automation] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch automation status" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const targetEmail = normalizeEmail(body.targetEmail);
    if (body.targetEmail && !targetEmail) {
      return NextResponse.json(
        { error: "Invalid targetEmail" },
        { status: 400 }
      );
    }

    const lookaheadDays = parseLookahead(
      body.lookaheadDays ?? getDefaultLookaheadDays()
    );
    const dryRun = parseBoolean(body.dryRun, getDefaultDryRun());
    const provider = normalizeProvider(
      body.provider ?? process.env.REMINDER_EMAIL_PROVIDER ?? "auto"
    );
    const useAida = parseBoolean(body.useAida, getDefaultUseAida());
    const fromEmail =
      typeof body.fromEmail === "string" ? body.fromEmail.trim() : "";

    const url = new URL(request.url);
    const cronUrl = new URL("/api/cron/reminders", url.origin);
    cronUrl.searchParams.set("lookaheadDays", String(lookaheadDays));
    cronUrl.searchParams.set("dryRun", dryRun ? "1" : "0");
    cronUrl.searchParams.set("provider", provider);
    cronUrl.searchParams.set("useAida", useAida ? "1" : "0");
    if (targetEmail) cronUrl.searchParams.set("targetEmail", targetEmail);
    if (fromEmail) cronUrl.searchParams.set("fromEmail", fromEmail);

    const cronSecret =
      (process.env.CRON_SECRET ?? "").trim() ||
      (process.env.VERCEL_CRON_SECRET ?? "").trim();

    const headers: Record<string, string> = {};
    if (cronSecret) {
      headers.Authorization = `Bearer ${cronSecret}`;
    }

    const cronResponse = await fetch(cronUrl.toString(), {
      method: "GET",
      headers,
    });

    const payload = await cronResponse.json().catch(() => null);
    if (!cronResponse.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Cron run failed",
          status: cronResponse.status,
          payload,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: cronResponse.status,
      payload,
    });
  } catch (error) {
    console.error("[admin/openclaw/automation] POST error:", error);
    return NextResponse.json(
      { error: "Failed to trigger automation run" },
      { status: 500 }
    );
  }
}
