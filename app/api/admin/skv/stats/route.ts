import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { qrTokens } from "@/lib/db/schema";
import { count, sql } from "drizzle-orm";
import {
  isCloneQrToSiteEnabled,
  getSkvServiceUrl,
  isRemoteSkvService,
} from "@/lib/skv/config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();

    const [tokenCount] = await db
      .select({ value: count() })
      .from(qrTokens);

    const recentTokens = await db
      .select({
        id: qrTokens.id,
        createdAt: qrTokens.createdAt,
        usedAt: qrTokens.usedAt,
        expiresAt: qrTokens.expiresAt,
      })
      .from(qrTokens)
      .orderBy(sql`${qrTokens.createdAt} DESC`)
      .limit(10);

    const configAvailable = !!(process.env.QR_SIGNING_SECRET ?? "").trim();
    const cloneQrToSiteEnabled = await isCloneQrToSiteEnabled();
    const skvServiceUrl = getSkvServiceUrl();
    const remoteSkvService = isRemoteSkvService();

    return NextResponse.json({
      qrTokenCount: tokenCount.value,
      recentTokens,
      configAvailable,
      cloneQrToSiteEnabled,
      skvServiceUrl,
      remoteSkvService,
    });
  } catch (error) {
    console.error("[admin/skv/stats] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch SKV stats" },
      { status: 500 }
    );
  }
}
