import { NextRequest, NextResponse } from "next/server";

const ADMIN_REALM = "Flytt.io Admin";

function unauthorized(isApiRequest: boolean) {
  const headers = new Headers({
    "WWW-Authenticate": `Basic realm="${ADMIN_REALM}", charset="UTF-8"`,
    "Cache-Control": "no-store",
  });

  if (isApiRequest) {
    return NextResponse.json(
      { error: "Unauthorized" },
      {
        status: 401,
        headers,
      }
    );
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers,
  });
}

function isAuthorized(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!auth || !auth.startsWith("Basic ")) return false;

  const base64 = auth.slice(6);
  let decoded = "";
  try {
    decoded = atob(base64);
  } catch {
    return false;
  }

  const sepIndex = decoded.indexOf(":");
  if (sepIndex === -1) return false;

  const username = decoded.slice(0, sepIndex);
  const password = decoded.slice(sepIndex + 1);

  const expectedUsername = (process.env.ADMIN_USERNAME ?? "admin").trim();
  const expectedPassword = (process.env.ADMIN_PASSWORD ?? "admin").trim();

  return username === expectedUsername && password === expectedPassword;
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isApiRequest = pathname.startsWith("/api/admin");

  // Allow external OpenClaw server to push events with token auth.
  if (
    pathname === "/api/admin/openclaw/events" &&
    request.method.toUpperCase() === "POST"
  ) {
    const expectedToken = (process.env.OPENCLAW_ADMIN_EVENTS_TOKEN ?? "").trim();
    const providedToken =
      request.headers.get("x-openclaw-admin-events-token")?.trim() ?? "";

    if (expectedToken && providedToken && providedToken === expectedToken) {
      return NextResponse.next();
    }
  }

  if (isAuthorized(request)) {
    return NextResponse.next();
  }

  return unauthorized(isApiRequest);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
