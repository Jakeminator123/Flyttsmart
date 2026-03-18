import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, moves, checklistItems } from "@/lib/db/schema";
import { buildChecklistTemplate } from "@/lib/checklist/template";

export const dynamic = "force-dynamic";

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return null;
  return normalized;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toIsoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function encodeHints(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const normalized = value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return normalized.length > 0 ? JSON.stringify(normalized) : null;
}

function countDueSoon(dates: Array<string | undefined>, lookaheadDays = 3): number {
  const today = new Date();
  const start = toIsoDate(today);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + lookaheadDays);
  const end = toIsoDate(endDate);

  return dates.filter((d) => typeof d === "string" && d >= start && d <= end)
    .length;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.email ?? body.targetEmail);
    if (!email) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : "Testkandidat Flytt";
    const toCity =
      typeof body.toCity === "string" && body.toCity.trim()
        ? body.toCity.trim()
        : "Stockholm";
    const moveDate =
      typeof body.moveDate === "string" && isIsoDate(body.moveDate)
        ? body.moveDate
        : (() => {
            const d = new Date();
            d.setDate(d.getDate() + 14);
            return toIsoDate(d);
          })();

    const db = getDb();

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    const userId =
      existingUser?.id ??
      (
        await db
          .insert(users)
          .values({
            name,
            email,
            phone: null,
            personalNumber: null,
          })
          .returning({ id: users.id })
      )[0].id;

    const [createdMove] = await db
      .insert(moves)
      .values({
        userId,
        fromStreet: "Exempelgatan 1",
        fromPostal: "41119",
        fromCity: "Goteborg",
        toStreet: "Testvagen 2",
        toPostal: "11122",
        toCity,
        apartmentNumber: null,
        propertyDesignation: null,
        propertyOwner: null,
        moveDate,
        householdType: "myself",
        reason: "admin_test_candidate",
        status: "submitted",
      })
      .returning({ id: moves.id });

    const templateItems = buildChecklistTemplate({ moveDate, toCity });
    if (templateItems.length > 0) {
      await db.insert(checklistItems).values(
        templateItems.map((item) => ({
          moveId: createdMove.id,
          taskKey: item.taskKey || null,
          sectionKey: item.sectionKey || null,
          section: item.section || null,
          title: item.title,
          description: item.description || null,
          dueDate: item.dueDate || null,
          completed: false,
          needHelp: false,
          wantCompare: false,
          status: "todo",
          comparisonHints: encodeHints(item.comparisonHints),
          category: item.category || null,
          sortOrder: item.sortOrder || 0,
        }))
      );
    }

    const dueSoonCount = countDueSoon(templateItems.map((i) => i.dueDate), 3);

    return NextResponse.json({
      ok: true,
      userId,
      moveId: createdMove.id,
      email,
      moveDate,
      checklistItemsCreated: templateItems.length,
      dueSoonCount,
    });
  } catch (error) {
    console.error("[admin/openclaw/automation/test-candidate] Error:", error);
    return NextResponse.json(
      { error: "Failed to create test candidate" },
      { status: 500 }
    );
  }
}
