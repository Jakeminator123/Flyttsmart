import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, moves, checklistItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// POST /api/move – Create a new move (and user if needed)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      personalNumber,
      email,
      phone,
      fromStreet,
      fromPostal,
      fromCity,
      toStreet,
      toPostal,
      toCity,
      moveDate,
      householdType,
      reason,
      checklist,
    } = body;

    if (!name || !toStreet || !moveDate) {
      return NextResponse.json(
        { error: "name, toStreet, and moveDate are required" },
        { status: 400 }
      );
    }

    // Create or find user
    const userResult = db
      .insert(users)
      .values({
        name,
        personalNumber: personalNumber || null,
        email: email || null,
        phone: phone || null,
      })
      .returning()
      .get();

    // Create the move
    const moveResult = db
      .insert(moves)
      .values({
        userId: userResult.id,
        fromStreet: fromStreet || null,
        fromPostal: fromPostal || null,
        fromCity: fromCity || null,
        toStreet,
        toPostal: toPostal || null,
        toCity: toCity || null,
        moveDate,
        householdType: householdType || null,
        reason: reason || null,
        status: "submitted",
      })
      .returning()
      .get();

    // Save checklist items if provided
    if (checklist && Array.isArray(checklist) && checklist.length > 0) {
      for (const item of checklist) {
        db.insert(checklistItems)
          .values({
            moveId: moveResult.id,
            title: item.title,
            description: item.description || null,
            dueDate: item.dueDate || null,
            category: item.category || null,
            sortOrder: item.sortOrder || 0,
          })
          .run();
      }
    }

    return NextResponse.json({
      success: true,
      moveId: moveResult.id,
      userId: userResult.id,
      status: moveResult.status,
    });
  } catch (error) {
    console.error("Move create error:", error);
    return NextResponse.json(
      { error: "Failed to create move" },
      { status: 500 }
    );
  }
}

// GET /api/move?id=X – Get a move by ID
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id parameter is required" },
        { status: 400 }
      );
    }

    const move = db.query.moves.findFirst({
      where: eq(moves.id, parseInt(id)),
    });

    if (!move) {
      return NextResponse.json({ error: "Move not found" }, { status: 404 });
    }

    const user = db.query.users.findFirst({
      where: eq(users.id, move.userId),
    });

    const items = db.query.checklistItems.findMany({
      where: eq(checklistItems.moveId, move.id),
    });

    return NextResponse.json({ move, user, checklist: items });
  } catch (error) {
    console.error("Move get error:", error);
    return NextResponse.json(
      { error: "Failed to get move" },
      { status: 500 }
    );
  }
}
