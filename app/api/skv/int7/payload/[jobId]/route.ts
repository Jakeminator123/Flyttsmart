import { NextRequest, NextResponse } from "next/server";
import { getUpstreamUrl, buildUpstreamHeaders } from "../../../clone/proxy-helpers";
import { upsertSkvRun } from "@/lib/skv/run-tracker";

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
    console.error("[SKV int7] payload params error:", e);
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const baseUrl = getUpstreamUrl(req);
  try {
    const res = await fetch(
      `${baseUrl}/api/payload/${encodeURIComponent(jobId)}`,
      {
        cache: "no-store",
        headers: buildUpstreamHeaders({ Accept: "application/json" }),
        signal: AbortSignal.timeout(8000),
      },
    );

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const data = await res.json();
      await upsertSkvRun({
        jobId,
        normalizedPayload: data?.payload ?? null,
      });
      return NextResponse.json(data, { status: res.status });
    }

    const text = await res.text();
    return NextResponse.json(
      { error: text || `Unexpected response (${res.status})` },
      { status: res.status },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[SKV int7] payload proxy error:", msg);
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
