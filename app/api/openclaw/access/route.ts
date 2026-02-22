import { NextRequest, NextResponse } from "next/server";
import {
  buildOpenClawSiteAccess,
  getOpenClawTokens,
} from "@/lib/openclaw/server-config";

const { bypassSecret: BYPASS_SECRET, accessToken: ACCESS_TOKEN } =
  getOpenClawTokens();

/**
 * GET /api/openclaw/access?token=<AGENT_TOKEN>&redirect=/adressandring
 *
 * Sets the Vercel deployment-protection bypass cookie and redirects
 * OpenClaw (or any authorized caller) to the requested page.
 * This lets OpenClaw's browser/crawler access protected preview deployments.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const redirect = req.nextUrl.searchParams.get("redirect") ?? "/";

  // Verify the caller is authorized
  if (!token || !ACCESS_TOKEN || token !== ACCESS_TOKEN) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (!BYPASS_SECRET) {
    // No deployment protection configured -- just redirect
    return NextResponse.redirect(new URL(redirect, req.nextUrl.origin));
  }

  // Build the redirect URL with the bypass cookie setter
  const bypassUrl = new URL(redirect, req.nextUrl.origin);
  bypassUrl.searchParams.set("x-vercel-set-bypass-cookie", "true");
  bypassUrl.searchParams.set("x-vercel-protection-bypass", BYPASS_SECRET);

  return NextResponse.redirect(bypassUrl);
}

/**
 * POST /api/openclaw/access
 *
 * Returns the bypass token and site info as JSON so OpenClaw
 * can add the header `x-vercel-protection-bypass: <token>` to its requests.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.token || body.token !== ACCESS_TOKEN) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const siteAccess = buildOpenClawSiteAccess(req);

    if (!siteAccess) {
      return NextResponse.json({
        baseUrl: req.nextUrl.origin,
        bypassHeader: "x-vercel-protection-bypass",
        bypassToken: null,
        usage: "No deployment protection is active -- direct access works.",
      });
    }

    return NextResponse.json({
      ...siteAccess,
      usage:
        "Add header 'x-vercel-protection-bypass: <bypassToken>' to all requests, or visit bypassCookieUrl once to set cookie access.",
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
