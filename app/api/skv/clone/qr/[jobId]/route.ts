import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_PORT = 8767;

function getServiceUrl(req: NextRequest): string {
  const portParam = req.nextUrl.searchParams.get("port");
  const port = portParam ? parseInt(portParam, 10) : undefined;
  if (Number.isFinite(port)) {
    return `http://127.0.0.1:${port}`;
  }
  const base = process.env.SKV_SERVICE_URL ?? `http://127.0.0.1:${DEFAULT_PORT}`;
  return base.replace(/\/$/, "");
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
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

  const baseUrl = getServiceUrl(req);
  try {
    const res = await fetch(`${baseUrl}/api/clone/qr/${encodeURIComponent(jobId)}`, {
      cache: "no-store",
      headers: { Accept: "image/png, image/*" },
    });

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
      { status: 502 }
    );
  }
}
