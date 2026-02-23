import { NextResponse } from "next/server";
import { isTruthy, isCloneQrToSiteEnabled, getSkvServiceUrl } from "@/lib/skv/config";

export async function GET() {
  return NextResponse.json({
    ok: true,
    bankIdQrOnlyVisible: isTruthy(process.env.SKV_SYNLIGT_SKV),
    cloneQrToSiteEnabled: await isCloneQrToSiteEnabled(),
    skvServiceUrl: getSkvServiceUrl(),
  });
}
