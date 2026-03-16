import { NextRequest, NextResponse } from "next/server";
import { getUpstreamUrl, buildUpstreamHeaders } from "../../../../clone/proxy-helpers";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ jobId: string; filename: string }> },
) {
  let jobId: string;
  let filename: string;
  try {
    const params = await context.params;
    jobId = params?.jobId ?? "";
    filename = params?.filename ?? "";
  } catch (e) {
    console.error("[SKV int7] qr-frame params error:", e);
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  if (!jobId || !filename) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const baseUrl = getUpstreamUrl(req);
  try {
    const res = await fetch(
      `${baseUrl}/api/qr-frame/${encodeURIComponent(jobId)}/${encodeURIComponent(filename)}`,
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
    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": res.headers.get("content-type") ?? "image/png",
      },
    });
  } catch (error) {
    console.error("[SKV int7] qr-frame proxy error:", error);
    return NextResponse.json(
      { ok: false, error: "SKV service unavailable" },
      { status: 502 },
    );
  }
}
