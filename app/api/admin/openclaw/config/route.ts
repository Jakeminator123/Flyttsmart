import { NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import {
  getOpenClawGatewayBaseUrl,
  getOpenClawAgentId,
} from "@/lib/openclaw/server-config";
import { addOpenClawEvent } from "@/lib/admin/openclaw-events";

export const dynamic = "force-dynamic";

const IDENTITY_PATH = join(
  process.cwd(),
  "claw",
  "config",
  "agents",
  "aida-flyttagent",
  "agent",
  "IDENTITY.md"
);

function boolFromEnv(value: string | undefined, fallback = false): boolean {
  if (!value) return fallback;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "y" || v === "yes";
}

type RedeployResult = {
  attempted: boolean;
  ok: boolean;
  reason?: string;
  details?: string;
  deployId?: string | null;
  status?: string | null;
};

async function triggerRenderRedeploy(): Promise<RedeployResult> {
  const renderServiceId = (process.env.RENDER_SERVICE_ID ?? "").trim();
  const renderApiKey = (process.env.RENDER_API_KEY ?? "").trim();

  if (!renderServiceId || !renderApiKey) {
    return {
      attempted: false,
      ok: false,
      reason:
        "Render deploy credentials missing (RENDER_SERVICE_ID, RENDER_API_KEY).",
    };
  }

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
    return {
      attempted: true,
      ok: false,
      reason: `Render API returned ${res.status}`,
      details: text,
    };
  }

  const data = await res.json();
  return {
    attempted: true,
    ok: true,
    deployId: data.id ?? data.deploy?.id ?? null,
    status: data.status ?? data.deploy?.status ?? null,
  };
}

export async function GET() {
  try {
    let identity = "";
    try {
      identity = await readFile(IDENTITY_PATH, "utf-8");
    } catch {
      identity = "(Could not read IDENTITY.md)";
    }

    const gatewayUrl = getOpenClawGatewayBaseUrl();
    const agentId = getOpenClawAgentId();
    const syncUrl = (process.env.OPENCLAW_ADMIN_SYNC_URL ?? "").trim();
    const autoRedeployOnSave = boolFromEnv(
      process.env.OPENCLAW_REDEPLOY_ON_SAVE,
      true
    );
    const renderConfigured =
      !!(process.env.RENDER_SERVICE_ID ?? "").trim() &&
      !!(process.env.RENDER_API_KEY ?? "").trim();

    let syncEndpoint: string | null = null;
    if (syncUrl) {
      try {
        syncEndpoint = new URL(syncUrl).origin;
      } catch {
        syncEndpoint = syncUrl;
      }
    }

    return NextResponse.json({
      identity,
      gatewayUrl,
      agentId,
      models: {
        primary:
          process.env.OPENCLAW_MODEL_PRIMARY ?? "openai/gpt-5.1-codex",
        fallback:
          process.env.OPENCLAW_MODEL_FALLBACK ?? "openai/gpt-5.3-codex",
      },
      sync: {
        configured: Boolean(syncUrl),
        endpoint: syncEndpoint,
      },
      redeploy: {
        autoOnSave: autoRedeployOnSave,
        renderConfigured,
      },
    });
  } catch (error) {
    console.error("[admin/openclaw/config] GET error:", error);
    return NextResponse.json(
      { error: "Failed to read config" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { identity, settings, redeploy } = body;

    if (typeof identity !== "string" || identity.trim().length === 0) {
      return NextResponse.json(
        { error: "Identity content is required" },
        { status: 400 }
      );
    }

    const writeResult: { ok: boolean; error?: string } = { ok: true };
    try {
      await writeFile(IDENTITY_PATH, identity, "utf-8");
    } catch (error) {
      writeResult.ok = false;
      writeResult.error =
        error instanceof Error ? error.message : "Failed to write IDENTITY.md";
      addOpenClawEvent({
        level: "warning",
        source: "admin-config-local-write",
        message: "Kunde inte skriva IDENTITY.md lokalt",
        details: writeResult.error,
      });
    }

    const syncUrl = (process.env.OPENCLAW_ADMIN_SYNC_URL ?? "").trim();
    const syncToken = (process.env.OPENCLAW_ADMIN_SYNC_TOKEN ?? "").trim();
    const syncResult: { attempted: boolean; ok: boolean; reason?: string } = {
      attempted: false,
      ok: false,
    };

    if (syncUrl) {
      syncResult.attempted = true;
      try {
        const syncResponse = await fetch(syncUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(syncToken ? { Authorization: `Bearer ${syncToken}` } : {}),
          },
          body: JSON.stringify({
            source: "flytt-admin",
            updatedAt: new Date().toISOString(),
            agentId: getOpenClawAgentId(),
            gatewayUrl: getOpenClawGatewayBaseUrl(),
            identity,
            settings:
              settings && typeof settings === "object" ? settings : undefined,
          }),
        });

        if (!syncResponse.ok) {
          syncResult.ok = false;
          syncResult.reason = `Sync endpoint returned ${syncResponse.status}`;
          addOpenClawEvent({
            level: "error",
            source: "admin-config-sync",
            message: "OpenClaw sync misslyckades",
            details: syncResult.reason,
          });
        } else {
          syncResult.ok = true;
          addOpenClawEvent({
            level: "info",
            source: "admin-config-sync",
            message: "OpenClaw sync skickad",
          });
        }
      } catch (error) {
        syncResult.ok = false;
        syncResult.reason =
          error instanceof Error ? error.message : "Sync request failed";
        addOpenClawEvent({
          level: "error",
          source: "admin-config-sync",
          message: "OpenClaw sync request failed",
          details: syncResult.reason,
        });
      }
    }

    const autoRedeployOnSave = boolFromEnv(
      process.env.OPENCLAW_REDEPLOY_ON_SAVE,
      true
    );
    const shouldRedeploy =
      typeof redeploy === "boolean" ? redeploy : autoRedeployOnSave;
    const redeployResult: RedeployResult = shouldRedeploy
      ? await triggerRenderRedeploy()
      : { attempted: false, ok: false, reason: "Skipped by request." };

    if (redeployResult.attempted) {
      addOpenClawEvent({
        level: redeployResult.ok ? "info" : "error",
        source: "admin-redeploy",
        message: redeployResult.ok
          ? "Redeploy av OpenClaw startad"
          : "Redeploy av OpenClaw misslyckades",
        details: redeployResult.ok
          ? redeployResult.deployId ?? undefined
          : redeployResult.reason,
      });
    }

    const syncRequired = Boolean(syncUrl);
    const syncSatisfied = !syncRequired || syncResult.ok;
    const writeSatisfied = writeResult.ok || syncResult.ok;
    const redeploySatisfied =
      !shouldRedeploy || redeployResult.ok || !redeployResult.attempted;

    const ok = writeSatisfied && syncSatisfied && redeploySatisfied;

    const status = ok ? 200 : 502;

    return NextResponse.json(
      {
        ok,
        error: ok
          ? null
          : syncRequired && !syncResult.ok
            ? syncResult.reason ?? "Sync failed"
            : !writeResult.ok
              ? writeResult.error ?? "Local write failed"
              : !redeploySatisfied
                ? redeployResult.reason ?? "Redeploy failed"
                : "Save failed",
        write: writeResult,
        sync: syncResult,
        redeploy: redeployResult,
      },
      { status }
    );
  } catch (error) {
    console.error("[admin/openclaw/config] PUT error:", error);
    return NextResponse.json(
      { error: "Failed to save config" },
      { status: 500 }
    );
  }
}
