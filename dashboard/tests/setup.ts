import { vi } from "vitest";

// `server-only` throws when imported outside React Server Components.
// Mock it to an empty module so unit tests can import the real lib modules.
vi.mock("server-only", () => ({}));

// Default test secrets — overridden per-test where needed.
process.env.ENTITLEMENT_SECRET ??= "test-entitlement-secret-please-rotate";
