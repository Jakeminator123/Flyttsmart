import { NextRequest, NextResponse } from "next/server";
import { buildChecklistTemplate } from "@/lib/checklist/template";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const moveDate =
      typeof body?.moveDate === "string" ? body.moveDate : undefined;
    const toCity = typeof body?.toCity === "string" ? body.toCity : undefined;

    const items = buildChecklistTemplate({ moveDate, toCity });
    return NextResponse.json({ items, source: "template" });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Could not generate checklist template",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
