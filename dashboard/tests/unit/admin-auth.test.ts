/**
 * Admin-auth tests: route-level gating around the REAL `lib/admin.ts`
 * (`getAdminUser` / `requireAdmin` / `AdminAuthError`).
 *
 * `lib/supabase/server` is `vi.mock`ed so `createServerSupabaseClient()` returns
 * a stub whose `auth.getUser()` resolves to whatever user the test installs —
 * no network, no real Supabase. `server-only` is mocked to an empty module so
 * the real `lib/admin.ts` can be imported in the node test environment.
 *
 * The "route" here is a thin local wrapper with the exact shape a real admin
 * route uses: call `requireAdmin()`, map `AdminAuthError` → its HTTP status,
 * and only then touch the database. Non-admin requests must produce 401/403
 * with zero DB mutations.
 */
import { describe, test, expect, beforeEach, vi } from "vitest";

const state = vi.hoisted(() => ({ user: null as any }));

vi.mock("server-only", () => ({}));

vi.mock("../../lib/supabase/server", () => ({
  createServerSupabaseClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user }, error: null }),
    },
  }),
  createServiceClient: () => {
    throw new Error("not used in this suite");
  },
}));

import { AdminAuthError, getAdminUser, requireAdmin } from "../../lib/admin";

/** Stand-in for the dashboard's mutation log — proves whether a DB write happened. */
const mutations: Array<{ adminId: string; at: string }> = [];

/** Minimal route-shaped wrapper around the REAL requireAdmin(). */
async function adminOnlyRoute() {
  try {
    const admin = await requireAdmin();
    mutations.push({ adminId: admin.id, at: new Date().toISOString() });
    return { status: 200 as const, body: { ok: true, admin } };
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return { status: e.status as 401 | 403, body: { ok: false, error: e.message } };
    }
    throw e;
  }
}

const adminUser = {
  id: "admin-1",
  email: "admin@example.com",
  app_metadata: { is_admin: true },
};
const plainUser = {
  id: "user-1",
  email: "user@example.com",
  app_metadata: {},
};

beforeEach(() => {
  state.user = null;
  mutations.length = 0;
});

describe("requireAdmin / getAdminUser (real lib/admin.ts)", () => {
  test("requireAdmin throws 401 when there is no session", async () => {
    state.user = null;
    const err = await requireAdmin().catch((e) => e);
    expect(err).toBeInstanceOf(AdminAuthError);
    expect(err.status).toBe(401);
  });

  test("requireAdmin throws 403 when the user is not an admin", async () => {
    state.user = plainUser;
    const err = await requireAdmin().catch((e) => e);
    expect(err).toBeInstanceOf(AdminAuthError);
    expect(err.status).toBe(403);
  });

  test("requireAdmin returns the admin user", async () => {
    state.user = adminUser;
    const admin = await requireAdmin();
    expect(admin).toEqual({ id: "admin-1", email: "admin@example.com" });
  });

  test("getAdminUser returns null for anonymous and non-admin users", async () => {
    state.user = null;
    expect(await getAdminUser()).toBeNull();
    state.user = plainUser;
    expect(await getAdminUser()).toBeNull();
  });

  test("getAdminUser returns the admin", async () => {
    state.user = adminUser;
    expect(await getAdminUser()).toEqual({ id: "admin-1", email: "admin@example.com" });
  });
});

describe("admin route gating", () => {
  test("unauthenticated → 401 and no DB mutation", async () => {
    state.user = null;
    const res = await adminOnlyRoute();
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
    expect(mutations).toHaveLength(0);
  });

  test("non-admin → 403 and no DB mutation", async () => {
    state.user = plainUser;
    const res = await adminOnlyRoute();
    expect(res.status).toBe(403);
    expect(res.body.ok).toBe(false);
    expect(mutations).toHaveLength(0);
  });

  test("admin → 200 and the mutation proceeds", async () => {
    state.user = adminUser;
    const res = await adminOnlyRoute();
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mutations).toHaveLength(1);
    expect(mutations[0].adminId).toBe("admin-1");
  });
});
