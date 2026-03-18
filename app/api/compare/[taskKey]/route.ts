import { NextRequest, NextResponse } from "next/server";
import {
  runComparison,
  getAllTaskKeys,
  getLiveTaskKeys,
  getStubTaskKeys,
} from "@/lib/comparison/compare";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ taskKey: string }> }
) {
  const { taskKey } = await params;
  const { searchParams } = req.nextUrl;

  const all = getAllTaskKeys();
  if (!all.includes(taskKey)) {
    return NextResponse.json(
      {
        error: `Unsupported taskKey "${taskKey}".`,
        supported: all,
        live: getLiveTaskKeys(),
        stub: getStubTaskKeys(),
      },
      { status: 400 }
    );
  }

  const result = await runComparison({
    taskKey,
    toPostal: searchParams.get("toPostal") ?? undefined,
    toCity: searchParams.get("toCity") ?? undefined,
    moveDate: searchParams.get("moveDate") ?? undefined,
    toStreet: searchParams.get("toStreet") ?? undefined,
  });

  return NextResponse.json(result);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskKey: string }> }
) {
  const { taskKey } = await params;

  const all = getAllTaskKeys();
  if (!all.includes(taskKey)) {
    return NextResponse.json(
      {
        error: `Unsupported taskKey "${taskKey}".`,
        supported: all,
        live: getLiveTaskKeys(),
        stub: getStubTaskKeys(),
      },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));

  const result = await runComparison({
    taskKey,
    toPostal: typeof body.toPostal === "string" ? body.toPostal : undefined,
    toCity: typeof body.toCity === "string" ? body.toCity : undefined,
    moveDate: typeof body.moveDate === "string" ? body.moveDate : undefined,
    toStreet: typeof body.toStreet === "string" ? body.toStreet : undefined,
  });

  return NextResponse.json(result);
}
