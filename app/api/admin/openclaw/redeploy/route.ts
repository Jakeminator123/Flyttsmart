import { NextResponse } from "next/server";
import { addOpenClawEvent } from "@/lib/admin/openclaw-events";

export const dynamic = "force-dynamic";

export async function POST() {
  const renderServiceId = (process.env.RENDER_SERVICE_ID ?? "").trim();
  const renderApiKey = (process.env.RENDER_API_KEY ?? "").trim();

  if (!renderServiceId || !renderApiKey) {
    return NextResponse.json(
      {
        error:
          "Render deploy credentials not configured (RENDER_SERVICE_ID, RENDER_API_KEY)",
        hint: "Set these in Vercel env vars to enable redeployment from admin.",
      },
      { status: 501 }
    );
  }

  try {
    const res = await fetch(
      `https://api.render.com/v1/services/${renderServiceId}/deploys`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${renderApiKey}`,
        },
        body: JSON.stringify({ clearCache: "do_not_clear" }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("[admin/openclaw/redeploy] Render API error:", text);
      addOpenClawEvent({
        level: "error",
        source: "admin-redeploy",
        message: "Render API returnerade fel vid redeploy",
        details: text,
      });
      return NextResponse.json(
        { error: `Render API returned ${res.status}`, details: text },
        { status: 502 }
      );
    }

    const data = await res.json();
    addOpenClawEvent({
      level: "info",
      source: "admin-redeploy",
      message: "Redeploy av OpenClaw startad",
      details: data.id ?? data.deploy?.id ?? undefined,
    });

    return NextResponse.json({
      ok: true,
      deployId: data.id ?? data.deploy?.id,
      status: data.status ?? data.deploy?.status,
    });
  } catch (error) {
    console.error("[admin/openclaw/redeploy] Error:", error);
    addOpenClawEvent({
      level: "error",
      source: "admin-redeploy",
      message: "Failed to trigger redeploy",
      details: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Failed to trigger redeploy" },
      { status: 500 }
    );
  }
}
