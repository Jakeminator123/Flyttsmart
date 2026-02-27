import { NextResponse } from "next/server";
import { getComparisonAdminConfig } from "@/lib/comparison/compare";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = getComparisonAdminConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error("[admin/comparisons/config] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch comparisons config" },
      { status: 500 }
    );
  }
}
