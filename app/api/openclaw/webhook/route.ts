import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  buildOpenClawSiteAccess,
  getOpenClawAgentId,
  getOpenClawGatewayBaseUrl,
  getOpenClawTokens,
} from "@/lib/openclaw/server-config";

const GATEWAY_BASE_URL = getOpenClawGatewayBaseUrl();
const AGENT_ID = getOpenClawAgentId();
const {
  webhookSecret: WEBHOOK_SECRET,
  hooksToken: HOOKS_TOKEN,
} = getOpenClawTokens();

const DEFAULT_HOOK_PATHS = ["/hooks/agent", "/hooks"];

let cachedHookPath: string | null = null;
let hasLoggedMissingHookEndpoint = false;
let hasLoggedAutoDetectedHookPath = false;

function normalizeHookPath(pathValue: string): string {
  const trimmed = pathValue.trim();
  if (!trimmed) return "";
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, "");
  return withoutTrailingSlash || "/";
}

function resolveHookPathCandidates(): string[] {
  const configured = normalizeHookPath(process.env.OPENCLAW_HOOKS_PATH ?? "");
  const candidates = configured
    ? [configured, ...DEFAULT_HOOK_PATHS]
    : [...DEFAULT_HOOK_PATHS];
  return [...new Set(candidates)];
}

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

function buildHookMessage(
  payload: {
    sessionId: string;
    event: string;
    formType: string;
    fields: Record<string, unknown>;
    currentStep?: number;
    meta?: Record<string, unknown>;
  },
  siteAccess: Record<string, unknown> | null
) {
  const eventPayload = {
    sessionId: payload.sessionId,
    event: payload.event,
    formType: payload.formType,
    currentStep: payload.currentStep ?? null,
    fields: payload.fields,
    meta: payload.meta ?? {},
  };

  return [
    "Flyttsmart form event received.",
    "Use this data as context for your next interactions:",
    JSON.stringify(eventPayload, null, 2),
    siteAccess
      ? [
          "For protected deployments, use this siteAccess helper:",
          JSON.stringify(siteAccess, null, 2),
        ].join("\n")
      : "No deployment protection helper is required in this environment.",
  ].join("\n\n");
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-openclaw-signature");

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

    // If no gateway URL is configured, log and return OK (testing mode)
    if (!GATEWAY_BASE_URL) {
      console.warn(
        "[OpenClaw] No gateway URL configured (OPENCLAW_GATEWAY_URL / OPENCLAW_AGENT_URL) — payload logged:",
        {
          sessionId,
          event,
          formType,
          fieldCount: Object.keys(fields).length,
        }
      );
      return NextResponse.json({ ok: true, mode: "log_only" });
    }

    if (!HOOKS_TOKEN) {
      console.warn("[OpenClaw] Missing HOOKS_TOKEN — skipping hook delivery");
      return NextResponse.json({ ok: true, mode: "missing_hooks_token" });
    }

    const siteAccess = buildOpenClawSiteAccess(req);
    const hookMessage = buildHookMessage(
      {
        sessionId,
        event,
        formType,
        fields,
        currentStep: payload.currentStep,
        meta: payload.meta,
      },
      siteAccess
    );

    const hookBody = JSON.stringify({
      message: hookMessage,
      name: "FormMirror",
      agentId: AGENT_ID,
      sessionKey: `hook:flyttanu:${sessionId}`,
      wakeMode: "now",
      deliver: false,
    });

    const candidatePaths = cachedHookPath
      ? [cachedHookPath]
      : resolveHookPathCandidates();
    let lastStatus = 404;
    let lastErrorText = "Not Found";

    for (const hookPath of candidatePaths) {
      const hooksUrl = `${GATEWAY_BASE_URL}${hookPath}`;
      const agentResponse = await fetch(hooksUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-openclaw-token": HOOKS_TOKEN,
        },
        body: hookBody,
      });

      if (agentResponse.ok) {
        cachedHookPath = hookPath;
        if (hookPath !== "/hooks/agent" && !hasLoggedAutoDetectedHookPath) {
          console.warn(
            `[OpenClaw] Auto-detected hooks endpoint at '${hookPath}'`
          );
          hasLoggedAutoDetectedHookPath = true;
        }
        const agentData = await agentResponse.json().catch(() => null);
        return NextResponse.json({
          ok: true,
          hookResponse: agentData ?? null,
        });
      }

      const errText = await agentResponse.text().catch(() => "Unknown error");
      lastStatus = agentResponse.status;
      lastErrorText = errText;

      // Continue probing on 404 to find a valid hooks path.
      if (agentResponse.status === 404) {
        if (cachedHookPath === hookPath) {
          cachedHookPath = null;
        }
        continue;
      }

      console.error(
        `[OpenClaw] ${hookPath} returned ${agentResponse.status}: ${errText}`
      );
      // Still return 200 to the client so the form is not blocked
      return NextResponse.json({ ok: true, agentStatus: agentResponse.status });
    }

    if (!hasLoggedMissingHookEndpoint) {
      console.warn(
        `[OpenClaw] Hooks endpoint not found (tried: ${resolveHookPathCandidates().join(", ")}). ` +
          "OpenClaw form mirroring is disabled until hooks are enabled/configured in the gateway."
      );
      hasLoggedMissingHookEndpoint = true;
    }

    return NextResponse.json({
      ok: true,
      mode: "hooks_endpoint_not_found",
      agentStatus: lastStatus,
      hookError: lastErrorText,
    });
  } catch (error) {
    console.error("[OpenClaw] Webhook error:", error);
    // Never block the user — always return 200
    return NextResponse.json({ ok: true, error: "Internal processing error" });
  }
}
