import crypto from "crypto";

export interface QrPersonData {
  /** Full name */
  n: string;
  /** Personal number (may be partial / hashed) */
  p?: string;
  /** Current address string */
  a?: string;
  /** Email */
  e?: string;
  /** Phone */
  t?: string;
  /** New address – street */
  ns?: string;
  /** New address – postal code */
  np?: string;
  /** New address – city */
  nc?: string;
  /** Move date (YYYY-MM-DD) */
  md?: string;
  /** Timestamp (unix seconds) */
  ts: number;
}

const getSecret = () => {
  const secret = process.env.QR_SIGNING_SECRET;
  if (!secret) throw new Error("QR_SIGNING_SECRET is not set");
  return secret;
};

/**
 * Encode person data into a base64 string + HMAC signature
 */
export function encodeQrData(data: QrPersonData): {
  encoded: string;
  signature: string;
} {
  const json = JSON.stringify(data);
  const encoded = Buffer.from(json, "utf-8").toString("base64url");
  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(encoded)
    .digest("base64url");
  return { encoded, signature };
}

/**
 * Build the full URL that the QR code will encode
 */
export function buildQrUrl(data: QrPersonData): string {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const { encoded, signature } = encodeQrData(data);
  return `${siteUrl}/start?d=${encoded}&sig=${signature}`;
}

/**
 * Verify HMAC signature and decode the data
 * Returns null if the signature is invalid or data is expired
 */
export function decodeAndVerifyQrData(
  encoded: string,
  signature: string,
  maxAgeSeconds = 30 * 24 * 60 * 60 // 30 days default
): QrPersonData | null {
  // Verify signature
  const expectedSig = crypto
    .createHmac("sha256", getSecret())
    .update(encoded)
    .digest("base64url");

  if (
    !crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSig)
    )
  ) {
    return null;
  }

  // Decode
  const json = Buffer.from(encoded, "base64url").toString("utf-8");
  const data: QrPersonData = JSON.parse(json);

  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (data.ts && now - data.ts > maxAgeSeconds) {
    return null;
  }

  return data;
}
