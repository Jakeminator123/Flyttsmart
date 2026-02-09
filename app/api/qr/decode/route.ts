import { NextRequest, NextResponse } from "next/server";
import { decodeAndVerifyQrData } from "@/lib/qr/encode";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { encoded, signature, url } = body;

    let d: string | null = encoded || null;
    let sig: string | null = signature || null;

    // If a full URL was provided, extract params
    if (url && !d) {
      try {
        const parsed = new URL(url);
        d = parsed.searchParams.get("d");
        sig = parsed.searchParams.get("sig");
      } catch {
        return NextResponse.json(
          { error: "Invalid URL format" },
          { status: 400 }
        );
      }
    }

    if (!d || !sig) {
      return NextResponse.json(
        { error: "Missing encoded data or signature" },
        { status: 400 }
      );
    }

    const data = decodeAndVerifyQrData(d, sig);

    if (!data) {
      return NextResponse.json(
        { error: "Invalid or expired QR code" },
        { status: 400 }
      );
    }

    // Map short keys to readable names
    return NextResponse.json({
      valid: true,
      data: {
        name: data.n,
        personalNumber: data.p || null,
        address: data.a || null,
        email: data.e || null,
        phone: data.t || null,
        toStreet: data.ns || null,
        toPostal: data.np || null,
        toCity: data.nc || null,
        moveDate: data.md || null,
        timestamp: data.ts,
      },
    });
  } catch (error) {
    console.error("QR decode error:", error);
    return NextResponse.json(
      { error: "Failed to decode QR code" },
      { status: 500 }
    );
  }
}
