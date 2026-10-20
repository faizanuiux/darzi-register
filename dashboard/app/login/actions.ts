"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// In-memory login rate limiter: 10 attempts per IP per 10 minutes.
// NOTE: this map lives in a single server process's memory. On multi-instance
// deployments (e.g. several Vercel serverless instances) each instance keeps
// its own counter, so an attacker can multiply their attempts by the number
// of instances. For production, swap this for a shared store — the Upstash
// upgrade path is: @upstash/redis + @upstash/ratelimit with a sliding-window
// limiter keyed on the client IP, keeping the same isRateLimited/recordAttempt
// interface.
// ---------------------------------------------------------------------------
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 10 * 60 * 1000;
const attempts = new Map<string, number[]>();

function getClientIp(): string {
  const h = headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return h.get("x-real-ip") ?? "unknown";
}

function recentAttempts(ip: string): number[] {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((ts) => now - ts < WINDOW_MS);
  attempts.set(ip, recent);
  return recent;
}

function isRateLimited(ip: string): boolean {
  return recentAttempts(ip).length >= MAX_ATTEMPTS;
}

function recordAttempt(ip: string): void {
  recentAttempts(ip).push(Date.now());
}

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export interface LoginState {
  error: string | null;
}

/**
 * Signs in with email + password, then enforces the admin gate: a session
 * whose user lacks `app_metadata.is_admin === true` is signed out immediately.
 * Error messages are intentionally generic — no user enumeration.
 */
export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const ip = getClientIp();

  if (isRateLimited(ip)) {
    return { error: "Too many attempts. Please try again later." };
  }
  recordAttempt(ip);

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Invalid credentials" };
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: "Invalid credentials" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdmin =
    !!user &&
    typeof user.app_metadata === "object" &&
    user.app_metadata !== null &&
    (user.app_metadata as Record<string, unknown>).is_admin === true;

  if (!isAdmin) {
    await supabase.auth.signOut();
    return { error: "Not authorized" };
  }

  redirect("/");
}
