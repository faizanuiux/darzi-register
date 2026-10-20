/** Thin JSON fetch wrapper for the admin APIs. Throws an Error carrying
 *  the server's message (if any) on non-2xx responses. */

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const msg =
      typeof body === "object" && body !== null
        ? ((body as Record<string, unknown>)["error"] as string) ??
          ((body as Record<string, unknown>)["message"] as string)
        : null;
    throw new Error(msg ?? `Request failed (${res.status})`);
  }

  return body as T;
}

export function buildQuery(
  params: Record<string, string | number | null | undefined>,
): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}
