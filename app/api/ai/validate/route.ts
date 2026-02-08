import { NextRequest, NextResponse } from "next/server";
import { validatePersonData } from "@/lib/ai/validate";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const result = await validatePersonData({
      name: body.name,
      address: body.address,
      postal: body.postal,
      city: body.city,
      personalNumber: body.personalNumber,
      email: body.email,
      phone: body.phone,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("AI validate error:", error);

    // If OpenAI key is not configured, return a pass-through result
    if (error.message?.includes("OPENAI_API_KEY")) {
      return NextResponse.json({
        confidence: 50,
        valid: true,
        suggestions: [
          "AI-validering ej tillgänglig (API-nyckel saknas). Manuell granskning krävs.",
        ],
        correctedData: null,
      });
    }

    return NextResponse.json(
      { error: "Validation failed" },
      { status: 500 }
    );
  }
}
