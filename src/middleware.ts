import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { isAuthorizedEmail } from "@/lib/adminAllowlist";

const { auth } = NextAuth(authConfig);

/**
 * Per-request nonce so the strict CSP (script-src 'self' + nonce, no
 * 'unsafe-inline') can still allow the inline flight-data scripts Next.js
 * itself emits for hydration. Note: a static strict
 * CSP would silently break client hydration.
 */
function cspHeader(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self' https://accounts.google.com",
    "frame-src https://accounts.google.com",
    "form-action 'self' https://accounts.google.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}

/**
 * Edge-runtime gate for /admin and /api/admin. Defense in depth only —
 * app/admin/(protected)/layout.tsx and every api/admin/* handler re-verify
 * authorization server-side; a misconfigured matcher here must never be the
 * only thing between a request and bidder data.
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAdminApi = pathname.startsWith("/api/admin");
  const isAdminPage = pathname.startsWith("/admin") && pathname !== "/admin/login";

  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = cspHeader(nonce);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const withCsp = (res: NextResponse) => {
    res.headers.set("Content-Security-Policy", csp);
    return res;
  };

  if (!isAdminApi && !isAdminPage) {
    return withCsp(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  const email = req.auth?.user?.email;
  if (isAuthorizedEmail(email)) {
    return withCsp(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  if (isAdminApi) {
    return withCsp(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  const loginUrl = new URL("/admin/login", req.nextUrl.origin);
  return withCsp(NextResponse.redirect(loginUrl));
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon).*)"],
};
