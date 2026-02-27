import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    bridgeEnabled:
      (process.env.NEXT_PUBLIC_DID_BRIDGE_ENABLED ?? "")
        .trim()
        .toLowerCase() === "true",
    clientKeySet: !!(process.env.NEXT_PUBLIC_DID_CLIENT_KEY ?? "").trim(),
    agentId: (process.env.NEXT_PUBLIC_DID_AGENT_ID ?? "").trim() || "–",
    mergeOcDid:
      (process.env.NEXT_PUBLIC_MERGE_OC_DID ?? "")
        .trim()
        .toLowerCase() === "y",
    testTal:
      (process.env.TEST_TAL ?? "").trim().toLowerCase() === "y",
  });
}
