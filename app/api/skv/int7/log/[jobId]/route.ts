import { NextRequest, NextResponse } from "next/server";
import { getUpstreamUrl, buildUpstreamHeaders } from "../../../clone/proxy-helpers";

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
    console.error("[SKV int7] log params error:", e);
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const baseUrl = getUpstreamUrl(req);
  try {
    const res = await fetch(`${baseUrl}/api/log/${encodeURIComponent(jobId)}`, {
      cache: "no-store",
      headers: buildUpstreamHeaders({ Accept: "text/plain, text/*" }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      return NextResponse.json(err, { status: res.status });
    }

    const text = await res.text();
    return new NextResponse(text, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Content-Type": res.headers.get("content-type") ?? "text/plain; charset=utf-8",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[SKV int7] log proxy error:", msg);
    return NextResponse.json(
      {
        ok: false,
        error: "SKV-tjänsten svarar inte.",
        details: process.env.NODE_ENV === "development" ? msg : undefined,
      },
      { status: 502 },
    );
  }
}
