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
    console.error("[SKV int7] qr-frames params error:", e);
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const baseUrl = getUpstreamUrl(req);
  try {
    const res = await fetch(
      `${baseUrl}/api/qr-frames/${encodeURIComponent(jobId)}`,
      {
        cache: "no-store",
        headers: buildUpstreamHeaders({ Accept: "application/json" }),
        signal: AbortSignal.timeout(8000),
      },
    );

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("[SKV int7] qr-frames proxy error:", error);
    return NextResponse.json(
      { ok: false, error: "SKV service unavailable" },
      { status: 502 },
    );
  }
}
