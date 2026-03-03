import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { users, moves, checklistItems, reminderLogs } from "@/lib/db/schema";
import { eq, sql, count, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const db = getDb();

    if (id) {
      const moveId = parseInt(id, 10);
      if (isNaN(moveId)) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
      }

      const [move] = await db
        .select()
        .from(moves)
        .where(eq(moves.id, moveId))
        .limit(1);

      if (!move) {
        return NextResponse.json({ error: "Move not found" }, { status: 404 });
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, move.userId))
        .limit(1);

      const items = await db
        .select()
        .from(checklistItems)
        .where(eq(checklistItems.moveId, move.id));

      const reminders = await db
        .select()
        .from(reminderLogs)
        .where(eq(reminderLogs.moveId, move.id));

      let enrichment = null;
      if (move.enrichmentData) {
        try {
          enrichment = JSON.parse(move.enrichmentData);
        } catch { /* ignore */ }
      }

      return NextResponse.json({
        user,
        move: { ...move, enrichmentData: undefined },
        enrichment,
        checklist: items,
        reminders,
      });
    }

    const allMoves = await db
      .select({
        moveId: moves.id,
        userId: users.id,
        name: users.name,
        firstName: users.firstName,
        lastName: users.lastName,
        personalNumber: users.personalNumber,
        email: users.email,
        phone: users.phone,
        fromCity: moves.fromCity,
        fromPostal: moves.fromPostal,
        toCity: moves.toCity,
        toPostal: moves.toPostal,
        moveDate: moves.moveDate,
        status: moves.status,
        hasChildren: moves.hasChildren,
        ipAddress: moves.ipAddress,
        ipCity: moves.ipCity,
        ipRegion: moves.ipRegion,
        ipCountry: moves.ipCountry,
        fromMunicipality: moves.fromMunicipality,
        fromCounty: moves.fromCounty,
        toMunicipality: moves.toMunicipality,
        toCounty: moves.toCounty,
        userAgent: moves.userAgent,
        createdAt: moves.createdAt,
      })
      .from(moves)
      .innerJoin(users, eq(moves.userId, users.id))
      .orderBy(desc(moves.createdAt));

    return NextResponse.json({ persons: allMoves });
  } catch (error) {
    console.error("[admin/personer] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch persons" },
      { status: 500 }
    );
  }
}
