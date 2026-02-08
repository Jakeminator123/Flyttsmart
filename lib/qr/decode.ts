import { decodeAndVerifyQrData, type QrPersonData } from "./encode";

/**
 * Parse a flytt.io QR URL and extract verified person data.
 * Returns null if the URL is invalid, signature fails, or data is expired.
 */
export function parseQrUrl(url: string): QrPersonData | null {
  try {
    const parsed = new URL(url);
    const encoded = parsed.searchParams.get("d");
    const signature = parsed.searchParams.get("sig");

    if (!encoded || !signature) return null;

    return decodeAndVerifyQrData(encoded, signature);
  } catch {
    return null;
  }
}

/**
 * Parse raw QR params (when extracted from URL search params on the client)
 */
export function parseQrParams(
  d: string | null,
  sig: string | null
): QrPersonData | null {
  if (!d || !sig) return null;
  return decodeAndVerifyQrData(d, sig);
}
