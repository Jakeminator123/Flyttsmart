import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const WEBHOOK_SECRET = process.env.OPENCLAW_WEBHOOK_SECRET ?? "";
const AGENT_URL = process.env.OPENCLAW_AGENT_URL ?? "";
const AGENT_TOKEN = process.env.OPENCLAW_AGENT_TOKEN ?? "";
const BYPASS_SECRET = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "";
const DEFAULT_REDIRECT_PATH = "/adressandring";

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

    // Build a human-readable message for the hook
    const fieldSummary = Object.entries(fields)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    const stepInfo = payload.currentStep
      ? ` (steg: ${payload.currentStep})`
      : "";
    const hookMessage = `Formularuppdatering: ${event} pa ${formType}${stepInfo}. Falt: ${fieldSummary}`;

    // Include site access info in the message so the agent can reach protected pages
    let siteAccessInfo = "";
    if (BYPASS_SECRET) {
      const accessEndpoint = `${req.nextUrl.origin}/api/openclaw/access`;
      siteAccessInfo =
        ` | Site access: baseUrl=${req.nextUrl.origin}, ` +
        `bypassHeader=x-vercel-protection-bypass, bypassToken=${BYPASS_SECRET}, ` +
        `cookieUrl=${accessEndpoint}?token=${encodeURIComponent(AGENT_TOKEN)}&redirect=${encodeURIComponent(DEFAULT_REDIRECT_PATH)}`;
    }

    // POST to OpenClaw hooks/agent endpoint
    // Strip any /sessions/... suffix from the URL in case user pasted the full session URL
    const baseUrl = AGENT_URL.replace(/\/+$/, "").replace(
      /\/sessions\/.*$/,
      ""
    );
    const hooksUrl = `${baseUrl}/hooks/agent`;
    const agentResponse = await fetch(hooksUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-openclaw-token": AGENT_TOKEN,
      },
      body: JSON.stringify({
        message: hookMessage + siteAccessInfo,
        name: "FormMirror",
        sessionKey: `hook:flyttsmart:${sessionId}`,
        wakeMode: "now",
        deliver: false,
      }),
    });

    if (!agentResponse.ok) {
      const errText = await agentResponse.text().catch(() => "Unknown error");
      console.error(
        `[OpenClaw] hooks/agent returned ${agentResponse.status}: ${errText}`
      );
      // Still return 200 to the client so the form is not blocked
      return NextResponse.json({ ok: true, agentStatus: agentResponse.status });
    }

    const agentData = await agentResponse.json().catch(() => null);

    return NextResponse.json({
      ok: true,
      hookResponse: agentData ?? null,
    });
  } catch (error) {
    console.error("[OpenClaw] Webhook error:", error);
    // Never block the user — always return 200
    return NextResponse.json({ ok: true, error: "Internal processing error" });
  }
}
