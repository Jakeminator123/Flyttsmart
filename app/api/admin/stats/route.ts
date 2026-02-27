import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { users, moves, checklistItems, qrTokens, reminderLogs } from "@/lib/db/schema";
import { count, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();

    const [userCount] = await db.select({ value: count() }).from(users);
    const [moveCount] = await db.select({ value: count() }).from(moves);
    const [checklistCount] = await db.select({ value: count() }).from(checklistItems);
    const [qrCount] = await db.select({ value: count() }).from(qrTokens);
    const [reminderCount] = await db.select({ value: count() }).from(reminderLogs);

    const statusDistribution = await db
      .select({
        status: moves.status,
        count: count(),
      })
      .from(moves)
      .groupBy(moves.status);

    const recentMoves = await db
      .select({
        id: moves.id,
        fromCity: moves.fromCity,
        toCity: moves.toCity,
        moveDate: moves.moveDate,
        status: moves.status,
        createdAt: moves.createdAt,
      })
      .from(moves)
      .orderBy(sql`${moves.createdAt} DESC`)
      .limit(10);

    const completedChecklist = await db
      .select({ value: count() })
      .from(checklistItems)
      .where(eq(checklistItems.completed, true));

    return NextResponse.json({
      counts: {
        users: userCount.value,
        moves: moveCount.value,
        checklistItems: checklistCount.value,
        completedChecklistItems: completedChecklist[0].value,
        qrTokens: qrCount.value,
        reminders: reminderCount.value,
      },
      statusDistribution: statusDistribution.map((s) => ({
        status: s.status,
        count: s.count,
      })),
      recentMoves,
    });
  } catch (error) {
    console.error("[admin/stats] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
