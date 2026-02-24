import { NextRequest, NextResponse } from "next/server";
import { getOpenClawAgentId, getOpenClawChatModel } from "@/lib/openclaw/server-config";

const AGENT_ID = getOpenClawAgentId();
const CHAT_MODEL = getOpenClawChatModel(AGENT_ID);

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-API-Key, x-api-key, api-key, OpenAI-Api-Key, x-openai-api-key",
  };
}

function buildModelIds(): string[] {
  const ids = new Set<string>();

  if (CHAT_MODEL) ids.add(CHAT_MODEL);
  if (AGENT_ID) ids.add(AGENT_ID);

  if (CHAT_MODEL.startsWith("openclaw:")) {
    const withoutPrefix = CHAT_MODEL.slice("openclaw:".length).trim();
    if (withoutPrefix) ids.add(withoutPrefix);
  }

  return Array.from(ids);
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

export async function GET(req: NextRequest) {
  const created = Math.floor(Date.now() / 1000);
  const data = buildModelIds().map((id) => ({
    id,
    object: "model",
    created,
    owned_by: "flyttio",
  }));

  return NextResponse.json(
    {
      object: "list",
      data,
    },
    { headers: corsHeaders(req.headers.get("origin")) },
  );
}
