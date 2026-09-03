import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.get(SESSION_COOKIE)?.value === "demo";

  if (!hasSession) {
    const loginUrl = new URL("/connexion", request.url);
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/personnes/:path*",
    "/groupes/:path*",
    "/vie-chretienne/:path*",
    "/agenda/:path*",
    "/profil/:path*",
  ],
};
