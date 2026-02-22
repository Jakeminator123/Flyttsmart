import { NextResponse } from "next/server";

function isTruthy(value: string | undefined): boolean {
  return (value ?? "").trim().toLowerCase() === "y";
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    bankIdQrOnlyVisible: isTruthy(process.env.SKV_SYNLIGT_SKV),
  });
}
