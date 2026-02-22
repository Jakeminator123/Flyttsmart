import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { users, moves, checklistItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function encodeHints(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const normalized = value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return normalized.length > 0 ? JSON.stringify(normalized) : null;
}

function decodeHints(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => typeof item === "string");
  } catch {
    return [];
  }
}

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
      apartmentNumber,
      propertyDesignation,
      propertyOwner,
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

    const db = getDb();

    // Create or find user
    const [userResult] = await db
      .insert(users)
      .values({
        name,
        personalNumber: personalNumber || null,
        email: email || null,
        phone: phone || null,
      })
      .returning();

    // Create the move
    const [moveResult] = await db
      .insert(moves)
      .values({
        userId: userResult.id,
        fromStreet: fromStreet || null,
        fromPostal: fromPostal || null,
        fromCity: fromCity || null,
        toStreet,
        toPostal: toPostal || null,
        toCity: toCity || null,
        apartmentNumber: apartmentNumber || null,
        propertyDesignation: propertyDesignation || null,
        propertyOwner: propertyOwner || null,
        moveDate,
        householdType: householdType || null,
        reason: reason || null,
        status: "submitted",
      })
      .returning();

    // Save checklist items if provided
    if (checklist && Array.isArray(checklist) && checklist.length > 0) {
      for (const item of checklist) {
        const fallbackTitle =
          typeof item?.taskKey === "string" ? item.taskKey : "Checklist item";
        await db.insert(checklistItems)
          .values({
            moveId: moveResult.id,
            taskKey: item.taskKey || null,
            sectionKey: item.sectionKey || null,
            section: item.section || null,
            title: item.title || fallbackTitle,
            description: item.description || null,
            dueDate: item.dueDate || null,
            completed: item.completed === true,
            needHelp: item.needHelp === true,
            wantCompare: item.wantCompare === true,
            status:
              item.status === "in_progress" || item.status === "done"
                ? item.status
                : "todo",
            comparisonHints: encodeHints(item.comparisonHints),
            category: item.category || null,
            sortOrder: item.sortOrder || 0,
          });
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
    const isConfigError =
      error instanceof Error &&
      error.message.includes("TURSO_DATABASE_URL");
    return NextResponse.json(
      {
        error: isConfigError
          ? "Database is not configured. Set TURSO_DATABASE_URL."
          : "Failed to create move",
      },
      { status: isConfigError ? 503 : 500 }
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

    const db = getDb();

    const [move] = await db
      .select()
      .from(moves)
      .where(eq(moves.id, parseInt(id)))
      .limit(1);

    if (!move) {
      return NextResponse.json({ error: "Move not found" }, { status: 404 });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, move.userId))
      .limit(1);

    const rawItems = await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.moveId, move.id));

    const items = rawItems.map((item) => ({
      ...item,
      comparisonHints: decodeHints(item.comparisonHints),
    }));

    return NextResponse.json({ move, user, checklist: items });
  } catch (error) {
    console.error("Move get error:", error);
    const isConfigError =
      error instanceof Error &&
      error.message.includes("TURSO_DATABASE_URL");
    return NextResponse.json(
      {
        error: isConfigError
          ? "Database is not configured. Set TURSO_DATABASE_URL."
          : "Failed to get move",
      },
      { status: isConfigError ? 503 : 500 }
    );
  }
}
