import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SENSITIVE_KEYS = new Set([
  "OPENAI_API_KEY",
  "OPENCLAW_GATEWAY_TOKEN",
]);

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
      `https://api.render.com/v1/services/${serviceId}/env-vars`,
      { headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` } }
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: `Render API ${res.status}` },
        { status: 502 }
      );
    }

    const data: Array<{ envVar: { key: string; value: string } }> = await res.json();
    const vars = data.map(({ envVar }) => ({
      key: envVar.key,
      value: SENSITIVE_KEYS.has(envVar.key)
        ? `${envVar.value.slice(0, 8)}…${envVar.value.slice(-4)}`
        : envVar.value,
      masked: SENSITIVE_KEYS.has(envVar.key),
    }));

    return NextResponse.json({ vars, serviceId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const { serviceId, apiKey, configured } = getRenderCreds();
  if (!configured) {
    return NextResponse.json(
      { error: "RENDER_SERVICE_ID / RENDER_API_KEY not configured" },
      { status: 501 }
    );
  }

  const body = await request.json();
  const updates: Array<{ key: string; value: string }> = body.updates;
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  for (const u of updates) {
    if (SENSITIVE_KEYS.has(u.key) && (u.value.includes("…") || u.value.length < 10)) {
      return NextResponse.json(
        { error: `Refusing to write masked/truncated value for ${u.key}` },
        { status: 400 }
      );
    }
  }

  try {
    const res = await fetch(
      `https://api.render.com/v1/services/${serviceId}/env-vars`,
      {
        method: "PUT",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(updates.map((u) => ({ key: u.key, value: u.value }))),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Render API ${res.status}`, details: text },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json({
      ok: true,
      updated: updates.map((u) => u.key),
      count: Array.isArray(data) ? data.length : 0,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
