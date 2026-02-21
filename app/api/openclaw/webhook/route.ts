import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const WEBHOOK_SECRET = process.env.OPENCLAW_WEBHOOK_SECRET ?? "";
const AGENT_URL = process.env.OPENCLAW_AGENT_URL ?? "";
const AGENT_TOKEN = process.env.OPENCLAW_AGENT_TOKEN ?? "";
const BYPASS_SECRET = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "";

/**
 * Verify the HMAC-SHA256 signature sent from the client.
 * If no secret is configured, verification is skipped (dev/testing mode).
 */
function verifySignature(body: string, signature: string | null): boolean {
  // Skip verification when no secret is configured (testing mode)
  if (!WEBHOOK_SECRET) return true;
  if (!signature) return false;

  try {
    const expected = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(body)
      .digest("hex");
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-openclaw-signature");

    // Verify HMAC signature
    if (!verifySignature(rawBody, signature)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const payload = JSON.parse(rawBody);

    // Validate required fields
    const { sessionId, event, formType, fields } = payload;
    if (!sessionId || !event || !formType || !fields) {
      return NextResponse.json(
        { error: "Missing required fields: sessionId, event, formType, fields" },
        { status: 400 }
      );
    }

    // If no agent URL is configured, log and return OK (testing mode)
    if (!AGENT_URL) {
      console.log("[OpenClaw] No AGENT_URL configured — payload logged:", {
        sessionId,
        event,
        formType,
        fieldCount: Object.keys(fields).length,
      });
      return NextResponse.json({ ok: true, mode: "log_only" });
    }

    // Forward to OpenClaw agent (fire-and-forget style, but we await for logging)
    const agentResponse = await fetch(AGENT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AGENT_TOKEN}`,
      },
      body: JSON.stringify({
        sessionId,
        event,
        formType,
        fields,
        currentStep: payload.currentStep ?? null,
        meta: payload.meta ?? {},
        // Provide the site URL + bypass token so OpenClaw can access protected pages
        siteAccess: BYPASS_SECRET
          ? {
              baseUrl: req.nextUrl.origin,
              bypassHeader: "x-vercel-protection-bypass",
              bypassToken: BYPASS_SECRET,
              bypassCookieUrl: `${req.nextUrl.origin}?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=${BYPASS_SECRET}`,
            }
          : undefined,
      }),
    });

    if (!agentResponse.ok) {
      const errText = await agentResponse.text().catch(() => "Unknown error");
      console.error(
        `[OpenClaw] Agent returned ${agentResponse.status}: ${errText}`
      );
      // Still return 200 to the client so the form is not blocked
      return NextResponse.json({ ok: true, agentStatus: agentResponse.status });
    }

    // Optionally return any field patches from the agent
    const agentData = await agentResponse.json().catch(() => null);

    return NextResponse.json({
      ok: true,
      fieldPatch: agentData?.fieldPatch ?? null,
      reply: agentData?.reply ?? null,
    });
  } catch (error) {
    console.error("[OpenClaw] Webhook error:", error);
    // Never block the user — always return 200
    return NextResponse.json({ ok: true, error: "Internal processing error" });
  }
}
