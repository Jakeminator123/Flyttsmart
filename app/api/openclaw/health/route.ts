import { NextRequest, NextResponse } from "next/server";
import {
  getAllowedModelPrefixes,
  getOpenClawAgentId,
  getOpenClawChatModel,
  getOpenClawGatewayBaseUrl,
  isModelAllowed,
  isModelPolicyEnforced,
  getModelForIntent,
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
  const modelByIntent = {
    simple: getModelForIntent("simple"),
    general: getModelForIntent("general"),
    comparison: getModelForIntent("comparison"),
  };
  const modelPolicyEnforced = isModelPolicyEnforced();
  const allowedModelPrefixes = getAllowedModelPrefixes();
  const rawPrimaryModel = (process.env.OPENCLAW_CHAT_MODEL ?? "").trim();
  const rawSimpleModel = (process.env.OPENCLAW_CHAT_MODEL_SIMPLE ?? "").trim();
  const controlUiDeviceAuthDisabled =
    ["1", "true", "y", "yes"].includes(
      (process.env.OPENCLAW_CONTROLUI_DISABLE_DEVICE_AUTH ?? "").trim().toLowerCase(),
    );
  const scbEnabled =
    (process.env.SCB_ENABLED ?? "").toLowerCase() === "y" ||
    (process.env.SCB_ENABLED ?? "").toLowerCase() === "true";
  const scbYear = process.env.SCB_YEAR ?? "2024";
  const scbTableId = process.env.SCB_TABLE_ID ?? "TAB638";
  const didBridgeEnabled =
    process.env.NEXT_PUBLIC_DID_BRIDGE_ENABLED === "true";
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
    modelByIntent,
    modelPolicy: {
      enforced: modelPolicyEnforced,
      allowedPrefixes: allowedModelPrefixes,
      rawPrimaryModel: rawPrimaryModel || "(default)",
      rawSimpleModel: rawSimpleModel || "(default)",
    },
    hasGatewayToken: Boolean(gatewayToken),
    hasHooksToken: Boolean(hooksToken),
    hasAccessToken: Boolean(accessToken),
    hasWebhookSecret: Boolean(webhookSecret),
    hasBypassSecret: Boolean(bypassSecret),
    scbEnabled,
    scbYear,
    scbTableId,
    didBridgeEnabled,
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
  if (rawPrimaryModel && !isModelAllowed(rawPrimaryModel)) {
    warnings.push(
      `OPENCLAW_CHAT_MODEL='${rawPrimaryModel}' bryter modellpolicyn. Tillatna prefix: ${allowedModelPrefixes.join(", ")} (enforce=${modelPolicyEnforced})`,
    );
  }
  if (rawSimpleModel && !isModelAllowed(rawSimpleModel)) {
    warnings.push(
      `OPENCLAW_CHAT_MODEL_SIMPLE='${rawSimpleModel}' bryter modellpolicyn. Tillatna prefix: ${allowedModelPrefixes.join(", ")} (enforce=${modelPolicyEnforced})`,
    );
  }
  if (controlUiDeviceAuthDisabled) {
    warnings.push(
      "OPENCLAW_CONTROLUI_DISABLE_DEVICE_AUTH=true ar osakert och bor vara avstangt i produktion.",
    );
  }

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
