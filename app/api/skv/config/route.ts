import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

function isTruthy(value: string | undefined): boolean {
  const v = (value ?? "").trim().toLowerCase();
  return ["1", "y", "yes", "true"].includes(v);
}

const SKV_SERVICE_URL = (process.env.SKV_SERVICE_URL ?? "http://127.0.0.1:8767").replace(/\/$/, "");
const CONFIG_FILE = path.join(process.cwd(), "inlogg", "config.txt");

async function isCloneQrToSiteEnabled(): Promise<boolean> {
  if (isTruthy(process.env.CLONE_QR_FROMPLAYWRIGHT_TO_SITE)) return true;
  if (isTruthy(process.env.SKV_CLONE_QR_FROMPLAYWRIGHT_TO_SITE)) return true;
  try {
    const raw = await fs.readFile(CONFIG_FILE, "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (key?.trim().toUpperCase() === "CLONE_QR_FROMPLAYWRIGHT_TO_SITE") {
        return isTruthy(rest.join("=").trim());
      }
    }
  } catch {
    // config.txt missing or unreadable
  }
  return false;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    bankIdQrOnlyVisible: isTruthy(process.env.SKV_SYNLIGT_SKV),
    cloneQrToSiteEnabled: await isCloneQrToSiteEnabled(),
    skvServiceUrl: SKV_SERVICE_URL,
  });
}
