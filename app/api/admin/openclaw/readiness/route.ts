import { NextResponse } from "next/server";
import {
  getOpenClawAgentId,
  getOpenClawChatModel,
  getModelForIntent,
} from "@/lib/openclaw/server-config";

export const dynamic = "force-dynamic";

type Severity = "critical" | "warning";

type ReadinessCheck = {
  key: string;
  label: string;
  ok: boolean;
  severity: Severity;
  details: string;
};

function hasAny(...keys: string[]): boolean {
  return keys.some((key) => Boolean((process.env[key] ?? "").trim()));
}

function boolFromEnv(value: string | undefined, fallback = false): boolean {
  if (!value) return fallback;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "y" || v === "yes";
}

export async function GET() {
  const agentId = getOpenClawAgentId();
  const modelPrimary = getOpenClawChatModel(agentId);
  const webSearchEnabled =
    (process.env.WEB_SEARCH_COMPARE ?? "").trim().toLowerCase() === "y";
  const didEnabled = process.env.NEXT_PUBLIC_DID_BRIDGE_ENABLED === "true";
  const providerPreference =
    (process.env.REMINDER_EMAIL_PROVIDER ?? "auto").trim().toLowerCase() || "auto";

  const checks: ReadinessCheck[] = [
    {
      key: "gateway_url",
      label: "OpenClaw gateway URL",
      ok: hasAny("OPENCLAW_GATEWAY_URL", "OPENCLAW_AGENT_URL"),
      severity: "critical",
      details: "OPENCLAW_GATEWAY_URL or OPENCLAW_AGENT_URL",
    },
    {
      key: "gateway_token",
      label: "OpenClaw gateway token",
      ok: hasAny("OPENCLAW_GATEWAY_TOKEN", "OPENCLAW_AGENT_TOKEN"),
      severity: "critical",
      details: "OPENCLAW_GATEWAY_TOKEN or OPENCLAW_AGENT_TOKEN",
    },
    {
      key: "agent_id",
      label: "OpenClaw agent id",
      ok: hasAny("OPENCLAW_AGENT_ID"),
      severity: "critical",
      details: "OPENCLAW_AGENT_ID",
    },
    {
      key: "site_access",
      label: "Site access tokens (API tools behind protection)",
      ok: hasAny("OPENCLAW_ACCESS_TOKEN") && hasAny("VERCEL_AUTOMATION_BYPASS_SECRET"),
      severity: "warning",
      details: "OPENCLAW_ACCESS_TOKEN + VERCEL_AUTOMATION_BYPASS_SECRET",
    },
    {
      key: "web_search_flag",
      label: "Web search comparisons enabled",
      ok: webSearchEnabled,
      severity: "warning",
      details: "WEB_SEARCH_COMPARE=y",
    },
    {
      key: "web_search_api_key",
      label: "OpenAI API key for web search",
      ok: !webSearchEnabled || hasAny("OPENAI_API_KEY"),
      severity: webSearchEnabled ? "critical" : "warning",
      details: "OPENAI_API_KEY (required when WEB_SEARCH_COMPARE=y)",
    },
    {
      key: "compare_tasks",
      label: "Comparison task list",
      ok: hasAny("COMPARE_TASKS_ENABLED"),
      severity: "warning",
      details: "COMPARE_TASKS_ENABLED",
    },
    {
      key: "email_provider_keys",
      label: "Email provider credentials",
      ok: hasAny("RESEND_API_KEY", "SENDGRID_API_KEY"),
      severity: "critical",
      details: "RESEND_API_KEY or SENDGRID_API_KEY",
    },
    {
      key: "email_from",
      label: "Email sender",
      ok: hasAny("REMINDER_EMAIL_FROM", "EMAIL_FROM"),
      severity: "critical",
      details: "REMINDER_EMAIL_FROM or EMAIL_FROM",
    },
    {
      key: "cron_secret",
      label: "Cron auth secret",
      ok: hasAny("CRON_SECRET", "VERCEL_CRON_SECRET"),
      severity: "warning",
      details: "CRON_SECRET or VERCEL_CRON_SECRET",
    },
    {
      key: "did_bridge",
      label: "D-ID bridge keys",
      ok:
        !didEnabled ||
        (hasAny("NEXT_PUBLIC_DID_CLIENT_KEY") && hasAny("NEXT_PUBLIC_DID_AGENT_ID")),
      severity: didEnabled ? "critical" : "warning",
      details:
        "NEXT_PUBLIC_DID_CLIENT_KEY + NEXT_PUBLIC_DID_AGENT_ID (only when DID bridge enabled)",
    },
    {
      key: "admin_redeploy",
      label: "Admin-triggered Render redeploy",
      ok: hasAny("RENDER_SERVICE_ID") && hasAny("RENDER_API_KEY"),
      severity: "warning",
      details: "RENDER_SERVICE_ID + RENDER_API_KEY",
    },
    {
      key: "admin_sync",
      label: "Admin sync endpoint",
      ok: !hasAny("OPENCLAW_ADMIN_SYNC_URL") || hasAny("OPENCLAW_ADMIN_SYNC_TOKEN"),
      severity: "warning",
      details: "OPENCLAW_ADMIN_SYNC_URL optionally with OPENCLAW_ADMIN_SYNC_TOKEN",
    },
  ];

  const missingCritical = checks.filter((c) => c.severity === "critical" && !c.ok);
  const missingWarnings = checks.filter((c) => c.severity === "warning" && !c.ok);

  return NextResponse.json({
    ok: missingCritical.length === 0,
    summary: {
      missingCritical: missingCritical.length,
      missingWarnings: missingWarnings.length,
    },
    context: {
      webSearchEnabled,
      didBridgeEnabled: didEnabled,
      reminderUseAida: boolFromEnv(process.env.REMINDER_USE_AIDA, true),
      providerPreference,
      modelRouting: {
        agentId,
        primary: modelPrimary,
        simple: getModelForIntent("simple"),
        general: getModelForIntent("general"),
        comparison: getModelForIntent("comparison"),
      },
    },
    checks,
  });
}
