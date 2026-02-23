import { NextRequest, NextResponse } from "next/server";
import { getUpstreamUrl, buildUpstreamHeaders } from "../../proxy-helpers";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  let jobId: string;
  try {
    const params = await context.params;
    jobId = params?.jobId ?? "";
  } catch (e) {
    console.error("[SKV clone] params error:", e);
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const baseUrl = getUpstreamUrl(req);
  try {
    const res = await fetch(
      `${baseUrl}/api/clone/state/${encodeURIComponent(jobId)}`,
      {
        cache: "no-store",
        headers: buildUpstreamHeaders({ Accept: "application/json" }),
        signal: AbortSignal.timeout(8000),
      },
    );

    const contentType = res.headers.get("content-type") ?? "";
    let data: unknown;
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = { ok: false, error: text || `Unexpected response (${res.status})` };
    }
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[SKV clone] state proxy error:", msg);
    return NextResponse.json(
      {
        ok: false,
        error: "SKV-tjänsten svarar inte. Kontrollera att Python/Playwright körs.",
        details: process.env.NODE_ENV === "development" ? msg : undefined,
      },
      { status: 502 },
    );
  }
}
