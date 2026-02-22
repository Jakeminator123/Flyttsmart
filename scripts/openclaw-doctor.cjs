#!/usr/bin/env node
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;

    const key = trimmed.slice(0, idx).trim();
    if (!key || process.env[key] != null) continue;

    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function readArg(name, fallback = "") {
  const index = process.argv.findIndex((arg) => arg === name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function normalizeBaseUrl(value) {
  if (!value) return "";
  const trimmed = value.trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function normalizeGatewayUrl(value) {
  const base = normalizeBaseUrl(value);
  if (!base) return "";

  try {
    const url = new URL(base);
    let pathname = url.pathname.replace(/\/+$/, "");
    pathname = pathname.replace(/\/sessions\/.*$/, "");
    if (pathname === "/config") pathname = "";
    url.pathname = pathname;
    url.search = "";
    url.hash = "";
    return `${url.origin}${url.pathname}`.replace(/\/$/, "");
  } catch {
    return "";
  }
}

function maskSecret(value) {
  if (!value) return "(missing)";
  if (value.length <= 8) return "*".repeat(value.length);
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function hmacSha256Hex(body, secret) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

function parseSseContent(raw) {
  let content = "";
  const lines = raw.split("\n");
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6).trim();
    if (!data || data === "[DONE]") continue;
    try {
      const parsed = JSON.parse(data);
      if (typeof parsed.content === "string") {
        content += parsed.content;
      }
    } catch {
      // Ignore malformed chunks.
    }
  }
  return content;
}

async function request(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Response may be SSE/plain text.
  }
  return { response, text, json };
}

async function main() {
  // Mirror Next.js local env precedence for this diagnostics script.
  loadEnvFile(path.join(process.cwd(), ".env"));
  loadEnvFile(path.join(process.cwd(), ".env.local"));

  const appUrl = normalizeBaseUrl(
    readArg("--app-url", process.env.OPENCLAW_DOCTOR_APP_URL || "http://localhost:3000")
  );

  const gatewayUrl = normalizeGatewayUrl(
    process.env.OPENCLAW_GATEWAY_URL ||
      process.env.OPENCLAW_AGENT_URL ||
      (process.env.NODE_ENV === "development" ? "http://127.0.0.1:18789" : "")
  );

  const agentId = process.env.OPENCLAW_AGENT_ID || "main";
  const model = process.env.OPENCLAW_CHAT_MODEL || `openclaw:${agentId}`;

  const gatewayToken =
    process.env.OPENCLAW_GATEWAY_TOKEN || process.env.OPENCLAW_AGENT_TOKEN || "";
  const hooksToken =
    process.env.OPENCLAW_HOOKS_TOKEN || process.env.OPENCLAW_AGENT_TOKEN || "";
  const accessToken =
    process.env.OPENCLAW_ACCESS_TOKEN ||
    process.env.OPENCLAW_AGENT_TOKEN ||
    process.env.OPENCLAW_HOOKS_TOKEN ||
    "";
  const webhookSecret = process.env.OPENCLAW_WEBHOOK_SECRET || "";
  const testTalEnabledFromEnv = (process.env.TEST_TAL || "").toLowerCase() === "y";
  const didBridgeEnabled =
    (process.env.NEXT_PUBLIC_DID_BRIDGE_ENABLED || "").toLowerCase() === "true";
  const didBridgeSecret = process.env.DID_BRIDGE_SECRET || "";
  const runDidCheck = readArg("--did", didBridgeEnabled ? "1" : "0") === "1";

  const prompt = readArg("--prompt", "Svara med exakt ordet DOCTOR_OK");
  const sessionId = `doctor-${Date.now()}`;

  console.log("OpenClaw doctor");
  console.log(`- appUrl: ${appUrl}`);
  console.log(`- gatewayUrl: ${gatewayUrl || "(missing)"}`);
  console.log(`- agentId/model: ${agentId} / ${model}`);
  console.log(`- gatewayToken: ${maskSecret(gatewayToken)}`);
  console.log(`- hooksToken: ${maskSecret(hooksToken)}`);
  console.log(`- accessToken: ${maskSecret(accessToken)}`);
  console.log(`- webhookSecret: ${maskSecret(webhookSecret)}`);
  console.log(`- testTalEnabled(env): ${testTalEnabledFromEnv}`);
  console.log(`- didBridgeEnabled: ${didBridgeEnabled}`);
  console.log(`- didBridgeSecret: ${maskSecret(didBridgeSecret)}`);

  const failures = [];

  let testTalEnabledFromHealth = false;

  // 0) Health endpoint through app proxy
  try {
    const { response, text, json } = await request(`${appUrl}/api/openclaw/health?debug=1`, {
      method: "GET",
    });
    console.log(`\n[health] ${response.status}`);
    console.log(json || text.slice(0, 300));
    testTalEnabledFromHealth = Boolean(json?.config?.testTalEnabled);
    if (!response.ok) failures.push(`health:${response.status}`);
  } catch (error) {
    console.log(`\n[health] request failed: ${String(error)}`);
    failures.push("health:network");
  }

  // 1) Access endpoint through app proxy
  try {
    const { response, text, json } = await request(`${appUrl}/api/openclaw/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: accessToken }),
    });
    const ok = response.ok;
    console.log(`\n[access] ${response.status}`);
    console.log(json || text.slice(0, 300));
    if (!ok) failures.push(`access:${response.status}`);
  } catch (error) {
    console.log(`\n[access] request failed: ${String(error)}`);
    failures.push("access:network");
  }

  // 2) Webhook endpoint through app proxy
  try {
    const payload = {
      sessionId,
      event: "field_change",
      formType: "adressandring",
      fields: { firstName: "Doctor", email: "doctor@example.com" },
      currentStep: 1,
      meta: {
        url: `${appUrl}/adressandring`,
        timestamp: new Date().toISOString(),
        userAgent: "openclaw-doctor",
      },
    };
    const raw = JSON.stringify(payload);
    const signature = webhookSecret ? hmacSha256Hex(raw, webhookSecret) : "";

    const { response, text, json } = await request(`${appUrl}/api/openclaw/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-openclaw-signature": signature,
      },
      body: raw,
    });

    console.log(`\n[webhook] ${response.status}`);
    console.log(json || text.slice(0, 300));
    if (!response.ok) failures.push(`webhook:${response.status}`);
  } catch (error) {
    console.log(`\n[webhook] request failed: ${String(error)}`);
    failures.push("webhook:network");
  }

  // 3) Chat endpoint through app proxy (SSE or JSON)
  try {
    const { response, text, json } = await request(`${appUrl}/api/openclaw/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        messages: [{ role: "user", content: prompt }],
        formContext: {
          formType: "adressandring",
          fields: { firstName: "Doctor" },
          currentStep: 1,
        },
      }),
    });

    const contentType = response.headers.get("content-type") || "";
    const answer = contentType.includes("text/event-stream")
      ? parseSseContent(text)
      : json?.content || text.slice(0, 300);

    console.log(`\n[chat] ${response.status} (${contentType || "unknown content-type"})`);
    console.log(answer || "(empty)");
    if (!response.ok) failures.push(`chat:${response.status}`);
  } catch (error) {
    console.log(`\n[chat] request failed: ${String(error)}`);
    failures.push("chat:network");
  }

  // 3b) D-ID bridge endpoint (optional)
  if (runDidCheck) {
    try {
      const headers = { "Content-Type": "application/json" };
      if (didBridgeSecret) {
        headers["x-did-bridge-secret"] = didBridgeSecret;
      }

      const { response, text, json } = await request(`${appUrl}/api/did/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          sessionId,
          message: "Svara med exakt ordet DID_OK",
          formContext: { formType: "did-voice" },
        }),
      });

      console.log(`\n[did-bridge] ${response.status}`);
      console.log(json || text.slice(0, 300));
      if (!response.ok) failures.push(`did-bridge:${response.status}`);
    } catch (error) {
      console.log(`\n[did-bridge] request failed: ${String(error)}`);
      failures.push("did-bridge:network");
    }

    try {
      const headers = { "Content-Type": "application/json" };
      if (didBridgeSecret) {
        headers["x-did-bridge-secret"] = didBridgeSecret;
      }

      const { response, text, json } = await request(`${appUrl}/api/did/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          eventType: "field_blur",
          sessionId,
          fieldName: "firstName",
          fieldValue: "Anna",
        }),
      });

      console.log(`\n[did-test-tal] ${response.status}`);
      console.log(json || text.slice(0, 300));
      if (!response.ok) {
        failures.push(`did-test-tal:${response.status}`);
      } else if (testTalEnabledFromHealth && !json?.shouldSpeak) {
        failures.push("did-test-tal:expected-shouldSpeak");
      }
    } catch (error) {
      console.log(`\n[did-test-tal] request failed: ${String(error)}`);
      failures.push("did-test-tal:network");
    }
  } else {
    console.log("\n[did-bridge] skipped (--did 1 to enable)");
  }

  // 4) Direct gateway checks (optional but useful in dev/cloud debugging)
  if (gatewayUrl && gatewayToken) {
    try {
      const { response, json, text } = await request(
        `${gatewayUrl}/v1/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${gatewayToken}`,
            "x-openclaw-agent-id": agentId,
          },
          body: JSON.stringify({
            model,
            stream: false,
            user: sessionId,
            messages: [{ role: "user", content: "Svara med ordet DIRECT_OK" }],
          }),
        }
      );

      console.log(`\n[gateway-chat] ${response.status}`);
      console.log(json || text.slice(0, 300));
      if (!response.ok) failures.push(`gateway-chat:${response.status}`);
    } catch (error) {
      console.log(`\n[gateway-chat] request failed: ${String(error)}`);
      failures.push("gateway-chat:network");
    }
  } else {
    console.log("\n[gateway-chat] skipped (missing gatewayUrl/gatewayToken)");
  }

  if (gatewayUrl && hooksToken) {
    try {
      const { response, json, text } = await request(`${gatewayUrl}/hooks/agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-openclaw-token": hooksToken,
        },
        body: JSON.stringify({
          message: "Svara med ordet DIRECT_HOOK_OK",
          name: "Doctor",
          agentId,
          sessionKey: `hook:doctor:${sessionId}`,
          wakeMode: "now",
          deliver: false,
        }),
      });

      console.log(`\n[gateway-hook] ${response.status}`);
      console.log(json || text.slice(0, 300));
      if (!response.ok) failures.push(`gateway-hook:${response.status}`);
    } catch (error) {
      console.log(`\n[gateway-hook] request failed: ${String(error)}`);
      failures.push("gateway-hook:network");
    }
  } else {
    console.log("\n[gateway-hook] skipped (missing gatewayUrl/hooksToken)");
  }

  if (failures.length > 0) {
    console.log(`\nFAILED checks (${failures.length}): ${failures.join(", ")}`);
    process.exit(1);
  }

  console.log("\nAll OpenClaw checks passed.");
}

main().catch((error) => {
  console.error("Doctor crashed:", error);
  process.exit(1);
});
