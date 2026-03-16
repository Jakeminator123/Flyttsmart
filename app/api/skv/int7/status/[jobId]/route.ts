import { NextRequest, NextResponse } from "next/server";
import { getUpstreamUrl, buildUpstreamHeaders } from "../../../clone/proxy-helpers";
import { upsertSkvRun } from "@/lib/skv/run-tracker";

export const runtime = "nodejs";

function buildArtifactUrls(jobId: string, req: NextRequest) {
  const query = req.nextUrl.searchParams.toString();
  const suffix = query ? `?${query}` : "";
  return {
    payloadUrl: `/api/skv/int7/payload/${jobId}${suffix}`,
    htmlUrl: `/api/skv/int7/html/${jobId}${suffix}`,
    screenshotUrl: `/api/skv/int7/screenshot/${jobId}${suffix}`,
    logUrl: `/api/skv/int7/log/${jobId}${suffix}`,
  };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  let jobId: string;
  try {
    const params = await context.params;
    jobId = params?.jobId ?? "";
  } catch (e) {
    console.error("[SKV int7] status params error:", e);
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const baseUrl = getUpstreamUrl(req);
  try {
    const res = await fetch(
      `${baseUrl}/api/status/${encodeURIComponent(jobId)}`,
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
        status: typeof data?.state === "string" ? data.state : "unknown",
        message: typeof data?.message === "string" ? data.message : null,
        startedAt:
          typeof data?.started_at === "number" || typeof data?.started_at === "string"
            ? data.started_at
            : null,
        endedAt:
          typeof data?.ended_at === "number" || typeof data?.ended_at === "string"
            ? data.ended_at
            : null,
        screenshotPath:
          typeof data?.screenshot_path === "string" ? data.screenshot_path : null,
        details: data?.details ?? null,
      });
      return NextResponse.json(
        {
          ...data,
          ...buildArtifactUrls(jobId, req),
        },
        { status: res.status },
      );
    }

    const text = await res.text();
    return NextResponse.json(
      { error: text || `Unexpected response (${res.status})` },
      { status: res.status },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[SKV int7] status proxy error:", msg);
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
