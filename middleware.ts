import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Rate limiter — sliding window per IP, in-memory.
// ⚠️  For multi-process / containerised deployments replace with Redis:
//     https://github.com/upstash/ratelimit
// ---------------------------------------------------------------------------
interface RateEntry { count: number; windowStart: number }
const rateLimitMap = new Map<string, RateEntry>();

const RATE_LIMIT      = 5;             // max requests per window
const RATE_WINDOW_MS  = 60 * 1000;    // 1-minute window
const CLEANUP_INTERVAL_MS = 60 * 1000;

// Periodically purge entries whose window has expired to prevent memory leaks.
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const cutoff = Date.now() - RATE_WINDOW_MS;
    for (const [ip, entry] of rateLimitMap) {
      if (entry.windowStart < cutoff) rateLimitMap.delete(ip);
    }
  }, CLEANUP_INTERVAL_MS);
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) ?? { count: 0, windowStart: now };

  // Reset window if it has expired
  if (now - entry.windowStart > RATE_WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }

  entry.count += 1;
  rateLimitMap.set(ip, entry);
  return entry.count > RATE_LIMIT;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // ── CSRF: exact-origin check for state-changing methods ─────────────────
  if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    const origin  = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const host    = request.headers.get("host");

    // Build the canonical allowed origin from the host header.
    const proto = request.nextUrl.protocol; // "http:" or "https:"
    const allowedOrigin = host ? `${proto}//${host}` : null;

    // Exact equality — substring matches are exploitable.
    const isSafeOrigin  = allowedOrigin && origin  === allowedOrigin;
    const isSafeReferer = allowedOrigin && referer?.startsWith(allowedOrigin);

    if (!isSafeOrigin && !isSafeReferer) {
      return NextResponse.json(
        { error: "CSRF validation failed." },
        { status: 403 }
      );
    }
  }

  // ── Rate limiting: auth routes only ─────────────────────────────────────
  if (pathname.startsWith("/api/auth/")) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
