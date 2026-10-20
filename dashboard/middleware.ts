import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

const PROTECTED_PATHS = ["/devices", "/licenses", "/activity", "/settings"];

function isAdminAppMetadata(appMetadata: unknown): boolean {
  if (typeof appMetadata !== "object" || appMetadata === null) return false;
  return (appMetadata as Record<string, unknown>).is_admin === true;
}

function isProtectedPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PROTECTED_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
}

/** Redirect while preserving any refreshed session cookies. */
function redirectPreservingCookies(
  path: string,
  request: NextRequest,
  supabaseResponse: NextResponse,
): NextResponse {
  const response = NextResponse.redirect(new URL(path, request.url));
  for (const cookie of supabaseResponse.cookies.getAll()) {
    response.cookies.set(cookie.name, cookie.value, cookie);
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isAdmin = !!user && isAdminAppMetadata(user.app_metadata);

  // Authenticated admins never see the login page.
  if (pathname === "/login") {
    if (isAdmin) {
      return redirectPreservingCookies("/", request, supabaseResponse);
    }
    return supabaseResponse;
  }

  // Dashboard and its sections are admin-only; everyone else goes to /login.
  if (isProtectedPath(pathname) && !isAdmin) {
    return redirectPreservingCookies("/login", request, supabaseResponse);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
