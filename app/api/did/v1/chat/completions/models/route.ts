import { NextRequest, NextResponse } from "next/server";
import {
  getOpenClawAgentId,
  getOpenClawChatModel,
} from "@/lib/openclaw/server-config";

const AGENT_ID = getOpenClawAgentId();
const CHAT_MODEL = getOpenClawChatModel(AGENT_ID);

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-API-Key, x-api-key, api-key, " +
      "OpenAI-Api-Key, x-openai-api-key",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

export async function GET(req: NextRequest) {
  const headers = corsHeaders(req.headers.get("origin"));

  return NextResponse.json(
    {
      object: "list",
      data: [
        {
          id: CHAT_MODEL,
          object: "model",
          created: Math.floor(Date.now() / 1000),
          owned_by: "openclaw",
        },
        {
          id: "openclaw",
          object: "model",
          created: Math.floor(Date.now() / 1000),
          owned_by: "openclaw",
        },
      ],
    },
    { headers },
  );
}
