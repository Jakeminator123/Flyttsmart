import { NextRequest, NextResponse } from "next/server";
import {
  getOpenClawAgentId,
  getOpenClawChatModel,
  getOpenClawGatewayBaseUrl,
  getOpenClawTokens,
} from "@/lib/openclaw/server-config";

function mask(value: string) {
  if (!value) return "(missing)";
  if (value.length <= 8) return "*".repeat(value.length);
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export async function GET(req: NextRequest) {
  const gatewayUrl = getOpenClawGatewayBaseUrl();
  const agentId = getOpenClawAgentId();
  const model = getOpenClawChatModel(agentId);
  const testTalEnabled = (process.env.TEST_TAL ?? "").toLowerCase() === "y";
  const {
    gatewayToken,
    hooksToken,
    accessToken,
    webhookSecret,
    bypassSecret,
  } = getOpenClawTokens();

  const config = {
    gatewayUrl,
    agentId,
    model,
    hasGatewayToken: Boolean(gatewayToken),
    hasHooksToken: Boolean(hooksToken),
    hasAccessToken: Boolean(accessToken),
    hasWebhookSecret: Boolean(webhookSecret),
    hasBypassSecret: Boolean(bypassSecret),
    testTalEnabled,
  };

  const warnings: string[] = [];
  if (!gatewayUrl) warnings.push("OPENCLAW_GATEWAY_URL/OPENCLAW_AGENT_URL saknas.");
  if (!gatewayToken)
    warnings.push("OPENCLAW_GATEWAY_TOKEN (eller OPENCLAW_AGENT_TOKEN) saknas.");
  if (!hooksToken)
    warnings.push("OPENCLAW_HOOKS_TOKEN (eller OPENCLAW_AGENT_TOKEN) saknas.");
  if (!accessToken)
    warnings.push("OPENCLAW_ACCESS_TOKEN (eller fallback-token) saknas.");
  if (!webhookSecret)
    warnings.push("OPENCLAW_WEBHOOK_SECRET saknas, signaturkontroll ar avstangd.");

  const includeMasked =
    req.nextUrl.searchParams.get("debug") === "1" ||
    process.env.NODE_ENV === "development";

  return NextResponse.json({
    ok: warnings.length === 0,
    config,
    warnings,
    ...(includeMasked
      ? {
          masked: {
            gatewayToken: mask(gatewayToken),
            hooksToken: mask(hooksToken),
            accessToken: mask(accessToken),
            webhookSecret: mask(webhookSecret),
            bypassSecret: mask(bypassSecret),
          },
        }
      : {}),
    now: new Date().toISOString(),
  });
}
