// middleware.js
import { NextResponse } from "next/server";
import { extractSiteSlugFromHost, isLikelyCustomDomain, isReservedHost, normalizeDomain } from "./lib/website-builder/publishConfig";

export function middleware(req) {
  const { pathname } = req.nextUrl;
  const host = normalizeDomain(req.headers.get("host") || "");

  if (!pathname.startsWith("/dev")) {
    const isInternalAsset = pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname === "/favicon.ico";
    if (!isInternalAsset && !isReservedHost(host)) {
      const rewriteUrl = req.nextUrl.clone();
      const subdomainSlug = extractSiteSlugFromHost(host);

      if (subdomainSlug) {
        rewriteUrl.pathname = `/sites/${subdomainSlug}${pathname === "/" ? "" : pathname}`;
        return NextResponse.rewrite(rewriteUrl);
      }

      if (isLikelyCustomDomain(host)) {
        rewriteUrl.pathname = `/sites/__host__${pathname === "/" ? "" : pathname}`;
        const requestHeaders = new Headers(req.headers);
        requestHeaders.set("x-site-host", host);
        return NextResponse.rewrite(rewriteUrl, {
          request: {
            headers: requestHeaders,
          },
        });
      }
    }

    return NextResponse.next();
  }
  if (pathname.startsWith("/dev/login")) return NextResponse.next();
  if (pathname.startsWith("/api/dev/session")) return NextResponse.next();

  const cookie = req.cookies.get("admin_key")?.value || "";
  const adminKey = process.env.ADMIN_DASH_KEY || "";
  if (!adminKey || cookie !== adminKey) {
    const url = req.nextUrl.clone();
    url.pathname = "/dev/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
