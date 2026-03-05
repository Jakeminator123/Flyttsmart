import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { moves, skvRuns, users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function parseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);

    const jobId = searchParams.get("jobId")?.trim();
    const moveIdParam = searchParams.get("moveId");
    const moveId = moveIdParam ? Number.parseInt(moveIdParam, 10) : null;

    const limitParam = Number.parseInt(searchParams.get("limit") ?? "100", 10);
    const limit = Number.isFinite(limitParam)
      ? Math.max(1, Math.min(500, limitParam))
      : 100;

    const baseSelect = {
      id: skvRuns.id,
      moveId: skvRuns.moveId,
      jobId: skvRuns.jobId,
      status: skvRuns.status,
      message: skvRuns.message,
      remote: skvRuns.remote,
      cloneQrEnabled: skvRuns.cloneQrEnabled,
      cloneQrStateUrl: skvRuns.cloneQrStateUrl,
      cloneQrImageUrl: skvRuns.cloneQrImageUrl,
      screenshotPath: skvRuns.screenshotPath,
      sourceData: skvRuns.sourceData,
      normalizedPayload: skvRuns.normalizedPayload,
      details: skvRuns.details,
      startedAt: skvRuns.startedAt,
      endedAt: skvRuns.endedAt,
      createdAt: skvRuns.createdAt,
      updatedAt: skvRuns.updatedAt,
      moveStatus: moves.status,
      moveDate: moves.moveDate,
      fromCity: moves.fromCity,
      toCity: moves.toCity,
      userName: users.name,
      userEmail: users.email,
    };

    if (jobId) {
      const [run] = await db
        .select(baseSelect)
        .from(skvRuns)
        .leftJoin(moves, eq(skvRuns.moveId, moves.id))
        .leftJoin(users, eq(moves.userId, users.id))
        .where(eq(skvRuns.jobId, jobId))
        .limit(1);

      if (!run) {
        return NextResponse.json({ error: "SKV run not found" }, { status: 404 });
      }

      return NextResponse.json({
        run: {
          ...run,
          sourceData: parseJson(run.sourceData),
          normalizedPayload: parseJson(run.normalizedPayload),
          details: parseJson(run.details),
        },
      });
    }

    const runs =
      moveId && Number.isInteger(moveId) && moveId > 0
        ? await db
        .select(baseSelect)
        .from(skvRuns)
        .leftJoin(moves, eq(skvRuns.moveId, moves.id))
        .leftJoin(users, eq(moves.userId, users.id))
        .where(eq(skvRuns.moveId, moveId))
        .orderBy(desc(skvRuns.createdAt))
        .limit(limit)
        : await db
            .select(baseSelect)
            .from(skvRuns)
            .leftJoin(moves, eq(skvRuns.moveId, moves.id))
            .leftJoin(users, eq(moves.userId, users.id))
            .orderBy(desc(skvRuns.createdAt))
            .limit(limit);

    return NextResponse.json({
      runs: runs.map((run) => ({
        ...run,
        sourceData: parseJson(run.sourceData),
        normalizedPayload: parseJson(run.normalizedPayload),
        details: parseJson(run.details),
      })),
    });
  } catch (error) {
    console.error("[admin/skv/runs] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch SKV runs" },
      { status: 500 },
    );
  }
}
