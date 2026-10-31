import { NextResponse, type NextRequest } from "next/server";

// Cheap edge gate: no cookie → login. Real session validation happens server-side.
export function middleware(req: NextRequest) {
  const has = req.cookies.has("aos_session");
  const { pathname } = req.nextUrl;
  if (!has && !pathname.startsWith("/login")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/health|api/webhooks).*)"],
};
