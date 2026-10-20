import "server-only";

import { cookies } from "next/headers";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";

/**
 * Server-side Supabase client bound to the request cookies (anon key, RLS on).
 * Use in Server Components, Server Actions, and API routes.
 */
export function createServerSupabaseClient() {
  const cookieStore = cookies();

  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options),
        );
      } catch {
        // setAll was called from a Server Component where cookies are
        // read-only; the middleware refresh keeps the session alive.
      }
    },
  };

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieMethods },
  );
}

/**
 * Service-role Supabase client (bypasses RLS).
 *
 * SERVER ONLY — NEVER import this in a client component (the `server-only`
 * import above enforces that at build time). Throws if the key is missing
 * so a misconfigured deploy fails loudly instead of silently degrading.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. createServiceClient() requires it.",
    );
  }

  return createServerClient(url!, serviceRoleKey, {
    cookies: {
      getAll() {
        return [];
      },
      // Service client is stateless: no session cookies to manage.
      setAll() {},
    } satisfies CookieMethodsServer,
  });
}
