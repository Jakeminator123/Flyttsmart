import { NextRequest } from "next/server";
import { getSkvServiceUrl, getSkvServiceApiKey } from "@/lib/skv/config";

const DEFAULT_PORT = 8767;

export function getUpstreamUrl(req: NextRequest): string {
  const portParam = req.nextUrl.searchParams.get("port");
  const port = portParam ? parseInt(portParam, 10) : undefined;
  if (Number.isFinite(port)) {
    return `http://127.0.0.1:${port}`;
  }
  const configured = getSkvServiceUrl();
  return configured || `http://127.0.0.1:${DEFAULT_PORT}`;
}

export function buildUpstreamHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const key = getSkvServiceApiKey();
  if (key) {
    headers["Authorization"] = `Bearer ${key}`;
  }
  return headers;
}
