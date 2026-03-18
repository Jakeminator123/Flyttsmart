import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getRenderCreds() {
  const serviceId = (process.env.RENDER_SERVICE_ID ?? "").trim();
  const apiKey = (process.env.RENDER_API_KEY ?? "").trim();
  return { serviceId, apiKey, configured: Boolean(serviceId && apiKey) };
}

export async function GET() {
  const { serviceId, apiKey, configured } = getRenderCreds();
  if (!configured) {
    return NextResponse.json(
      { error: "RENDER_SERVICE_ID / RENDER_API_KEY not configured" },
      { status: 501 }
    );
  }

  try {
    const res = await fetch(
      `https://api.render.com/v1/services/${serviceId}/deploys?limit=10`,
      { headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` } }
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: `Render API ${res.status}` },
        { status: 502 }
      );
    }

    const data: Array<{ deploy: {
      id: string;
      status: string;
      trigger: string;
      createdAt: string;
      updatedAt: string;
      finishedAt?: string;
      commit?: { id: string; message: string; createdAt: string };
    } }> = await res.json();

    const deploys = data.map(({ deploy }) => ({
      id: deploy.id,
      status: deploy.status,
      trigger: deploy.trigger,
      createdAt: deploy.createdAt,
      finishedAt: deploy.finishedAt ?? null,
      commitMessage: deploy.commit?.message ?? null,
      commitId: deploy.commit?.id?.slice(0, 7) ?? null,
    }));

    return NextResponse.json({ deploys, serviceId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
