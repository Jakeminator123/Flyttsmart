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
    console.error("[SKV clone] qr params error:", e);
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const baseUrl = getUpstreamUrl(req);
  try {
    const res = await fetch(
      `${baseUrl}/api/clone/qr/${encodeURIComponent(jobId)}`,
      {
        cache: "no-store",
        headers: buildUpstreamHeaders({ Accept: "image/png, image/*" }),
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      return NextResponse.json(err, { status: res.status });
    }

    const blob = await res.blob();
    const contentType = res.headers.get("content-type") ?? "image/png";
    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    console.error("[SKV clone] qr proxy error:", error);
    return NextResponse.json(
      { ok: false, error: "SKV service unavailable" },
      { status: 502 },
    );
  }
}
