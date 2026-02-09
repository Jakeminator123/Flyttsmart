import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { buildQrUrl, type QrPersonData } from "@/lib/qr/encode";
import { db } from "@/lib/db";
import { qrTokens } from "@/lib/db/schema";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      personalNumber,
      address,
      email,
      phone,
      toStreet,
      toPostal,
      toCity,
      moveDate,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Build QR person data
    const qrData: QrPersonData = {
      n: name,
      p: personalNumber || undefined,
      a: address || undefined,
      e: email || undefined,
      t: phone || undefined,
      ns: toStreet || undefined,
      np: toPostal || undefined,
      nc: toCity || undefined,
      md: moveDate || undefined,
      ts: Math.floor(Date.now() / 1000),
    };

    // Build signed URL
    const url = buildQrUrl(qrData);

    // Generate QR code as data URL (PNG)
    const qrImageDataUrl = await QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: {
        dark: "#002e6d",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    });

    // Store token in database (graceful – QR still works via HMAC if DB fails)
    let expiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    try {
      const tokenHash = crypto
        .createHash("sha256")
        .update(url)
        .digest("hex");

      await db.insert(qrTokens)
        .values({
          tokenHash,
          encodedData: JSON.stringify(qrData),
          expiresAt,
        });
    } catch (dbError) {
      // DB insert failed – QR still works because decode uses HMAC verification, not DB
      console.warn("QR token DB insert failed (non-critical):", dbError);
    }

    return NextResponse.json({
      url,
      qrImage: qrImageDataUrl,
      expiresAt,
    });
  } catch (error) {
    console.error("QR generate error:", error);
    return NextResponse.json(
      { error: "Failed to generate QR code" },
      { status: 500 }
    );
  }
}
