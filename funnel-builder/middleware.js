// middleware.js
import { NextResponse } from "next/server";

export function middleware(req) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/dev")) return NextResponse.next();
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

export const config = { matcher: ["/dev/:path*"] };
