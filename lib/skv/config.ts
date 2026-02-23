import path from "path";
import { promises as fs } from "fs";

const CONFIG_FILE = path.join(process.cwd(), "inlogg", "config.txt");

export function isTruthy(value: string | undefined | null): boolean {
  const v = (value ?? "").trim().toLowerCase();
  return ["1", "y", "yes", "true"].includes(v);
}

export async function readConfigValue(key: string): Promise<string | undefined> {
  try {
    const raw = await fs.readFile(CONFIG_FILE, "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [k, ...rest] = trimmed.split("=");
      if (k?.trim().toUpperCase() === key.toUpperCase()) {
        return rest.join("=").trim();
      }
    }
  } catch {
    // config.txt missing or unreadable
  }
  return undefined;
}

export async function isCloneQrToSiteEnabled(): Promise<boolean> {
  if (isTruthy(process.env.CLONE_QR_FROMPLAYWRIGHT_TO_SITE)) return true;
  if (isTruthy(process.env.SKV_CLONE_QR_FROMPLAYWRIGHT_TO_SITE)) return true;
  const val = await readConfigValue("CLONE_QR_FROMPLAYWRIGHT_TO_SITE");
  return isTruthy(val);
}

export function getSkvServiceUrl(): string {
  return (process.env.SKV_SERVICE_URL ?? "").replace(/\/$/, "");
}

export function getSkvServiceApiKey(): string | undefined {
  return process.env.SKV_SERVICE_API_KEY?.trim() || undefined;
}

export function isRemoteSkvService(): boolean {
  const url = getSkvServiceUrl();
  return !!url && !url.includes("127.0.0.1") && !url.includes("localhost");
}
