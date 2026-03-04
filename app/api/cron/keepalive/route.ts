import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const PING_TIMEOUT_MS = 15_000;

function normalizeToken(req: NextRequest): string {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length).trim();
  }
  return (req.headers.get("x-cron-secret") || "").trim();
}

function toHealthUrl(rawUrl: string, healthPath = "/health"): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const basePath = url.pathname.replace(/\/+$/, "");
    const normalizedHealthPath = healthPath.startsWith("/") ? healthPath : `/${healthPath}`;
    url.pathname = basePath.endsWith(normalizedHealthPath)
      ? basePath
      : `${basePath || ""}${normalizedHealthPath}`;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

async function ping(name: string, url: string) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      signal:
        typeof (AbortSignal as { timeout?: (ms: number) => AbortSignal }).timeout === "function"
          ? (AbortSignal as { timeout: (ms: number) => AbortSignal }).timeout(PING_TIMEOUT_MS)
          : undefined,
    });
    return {
      name,
      url,
      ok: res.ok,
      status: res.status,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return {
      name,
      url,
      ok: false,
      status: 0,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET(req: NextRequest) {
  const expectedSecret = (process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET || "").trim();
  const providedSecret = normalizeToken(req);

  if (expectedSecret && providedSecret !== expectedSecret) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized keepalive request" },
      { status: 401 },
    );
  }

  const rawTargets = [
    { name: "openclaw", url: process.env.OPENCLAW_GATEWAY_URL || "", healthPath: "/health" },
    { name: "ratsitScraper", url: process.env.RATSIT_SCRAPER_URL || "", healthPath: "/health" },
    { name: "skvPlaywright", url: process.env.SKV_SERVICE_URL || "", healthPath: "/api/health" },
  ];

  const targets = rawTargets
    .map((target) => ({ ...target, healthUrl: toHealthUrl(target.url, target.healthPath) }))
    .filter(
      (target): target is { name: string; url: string; healthPath: string; healthUrl: string } =>
        Boolean(target.healthUrl),
    );

  if (targets.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No keepalive targets configured" },
      { status: 500 },
    );
  }

  const results = await Promise.all(targets.map((target) => ping(target.name, target.healthUrl)));
  const ok = results.every((result) => result.ok);

  return NextResponse.json({
    ok,
    now: new Date().toISOString(),
    targets: results,
  });
}
