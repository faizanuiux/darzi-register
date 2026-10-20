import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Session is stored in http-only cookies
 * (managed by @supabase/ssr) — never in localStorage or app code.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
