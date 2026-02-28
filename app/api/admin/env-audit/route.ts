import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const envChecks: Array<{ key: string; category: string; anyOf: string[] }> = [
  { key: "OPENCLAW_GATEWAY_URL", category: "OpenClaw", anyOf: ["OPENCLAW_GATEWAY_URL"] },
  { key: "OPENCLAW_GATEWAY_TOKEN", category: "OpenClaw", anyOf: ["OPENCLAW_GATEWAY_TOKEN"] },
  { key: "OPENCLAW_AGENT_ID", category: "OpenClaw", anyOf: ["OPENCLAW_AGENT_ID"] },
  { key: "OPENCLAW_WEBHOOK_SECRET", category: "OpenClaw", anyOf: ["OPENCLAW_WEBHOOK_SECRET"] },
  { key: "OPENAI_API_KEY", category: "AI", anyOf: ["OPENAI_API_KEY"] },
  { key: "TURSO_DATABASE_URL", category: "Database", anyOf: ["TURSO_DATABASE_URL"] },
  { key: "TURSO_AUTH_TOKEN", category: "Database", anyOf: ["TURSO_AUTH_TOKEN"] },
  { key: "NEXT_PUBLIC_DID_BRIDGE_ENABLED", category: "D-ID", anyOf: ["NEXT_PUBLIC_DID_BRIDGE_ENABLED"] },
  { key: "NEXT_PUBLIC_DID_CLIENT_KEY", category: "D-ID", anyOf: ["NEXT_PUBLIC_DID_CLIENT_KEY"] },
  { key: "NEXT_PUBLIC_DID_AGENT_ID", category: "D-ID", anyOf: ["NEXT_PUBLIC_DID_AGENT_ID"] },
  { key: "DID_BRIDGE_SECRET", category: "D-ID", anyOf: ["DID_BRIDGE_SECRET"] },
  { key: "TEST_TAL", category: "D-ID", anyOf: ["TEST_TAL"] },
  { key: "NEXT_PUBLIC_MERGE_OC_DID", category: "D-ID", anyOf: ["NEXT_PUBLIC_MERGE_OC_DID"] },
  { key: "REMINDER_EMAIL_PROVIDER", category: "Automation", anyOf: ["REMINDER_EMAIL_PROVIDER"] },
  { key: "REMINDER_EMAIL_FROM / EMAIL_FROM", category: "Automation", anyOf: ["REMINDER_EMAIL_FROM", "EMAIL_FROM"] },
  { key: "RESEND_API_KEY / SENDGRID_API_KEY", category: "Automation", anyOf: ["RESEND_API_KEY", "SENDGRID_API_KEY"] },
  { key: "CRON_SECRET / VERCEL_CRON_SECRET", category: "Automation", anyOf: ["CRON_SECRET", "VERCEL_CRON_SECRET"] },
  { key: "QR_SIGNING_SECRET", category: "SKV", anyOf: ["QR_SIGNING_SECRET"] },
  { key: "RENDER_API_KEY", category: "Render", anyOf: ["RENDER_API_KEY"] },
  { key: "RENDER_SERVICE_ID", category: "Render", anyOf: ["RENDER_SERVICE_ID"] },
  { key: "WEB_SEARCH_COMPARE", category: "Jämförelser", anyOf: ["WEB_SEARCH_COMPARE"] },
  { key: "COMPARE_TASKS_ENABLED", category: "Jämförelser", anyOf: ["COMPARE_TASKS_ENABLED"] },
];

export async function GET() {
  const result = envChecks.map(({ key, category, anyOf }) => ({
    key,
    category,
    set: anyOf.some((envKey) => !!(process.env[envKey] ?? "").trim()),
  }));

  return NextResponse.json(result);
}
