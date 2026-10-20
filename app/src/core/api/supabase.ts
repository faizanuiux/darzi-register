/**
 * Typed Supabase REST fetch wrapper.
 *
 * Plain fetch keeps the bundle small and the code fully typed — no Supabase JS
 * client. All requests carry the publishable anon key only; a service-role key
 * must NEVER be bundled with the app.
 *
 * SECURITY: license keys travel inside the URL query string. They are never
 * included in error messages or logs.
 */

import { ENV } from '../config/env';

const REQUEST_TIMEOUT_MS = 15_000;

function baseHeaders(): Record<string, string> {
  return {
    apikey: ENV.supabaseAnonKey,
    Authorization: `Bearer ${ENV.supabaseAnonKey}`,
    'Content-Type': 'application/json',
  };
}

/** The request never left the device or timed out. */
export class NetworkError extends Error {
  /** Sanitized underlying error info (e.g. "TypeError: Unable to resolve
   * host ..."), never contains URL query strings or key material. */
  readonly detail?: string;
  constructor(message = 'Network request failed', detail?: string) {
    super(message);
    this.name = 'NetworkError';
    this.detail = detail;
  }
}

/**
 * Sanitize technical detail for on-device display: strip URL query strings
 * (license keys travel in query params) and cap length. The license key
 * format (DRZ-XXXX-XXXX) is additionally scrubbed as a backstop.
 */
export function sanitizeErrorDetail(raw: string): string {
  const withoutQuery = raw.split('?')[0];
  const withoutKey = withoutQuery.replace(
    /DRZ-[A-Z0-9]{4}-[A-Z0-9]{4}/gi,
    'DRZ-XXXX-XXXX',
  );
  return withoutKey.slice(0, 200);
}

/** The resource does not exist (HTTP 404 or empty PostgREST array). */
export class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/** The server answered with an unexpected / auth / 5xx status, or an
 * unreadable body. The license key is never part of the message. */
export class ServerError extends Error {
  readonly status: number;
  constructor(status: number, message = 'Server request failed') {
    super(message);
    this.name = 'ServerError';
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${ENV.supabaseUrl}${path}`, {
      ...init,
      signal: controller.signal,
    });
  } catch (err) {
    // Includes aborts — both mean the request never completed.
    const reason =
      err instanceof Error && err.name === 'AbortError'
        ? 'Request timed out'
        : 'Network request failed';
    // Preserve the original error's name + message so on-device diagnostics
    // can show the REAL reason (DNS, TLS, timeout, ...). Sanitized: no
    // query strings, no key material.
    const detail =
      err instanceof Error
        ? sanitizeErrorDetail(`${err.name}: ${err.message}`)
        : reason;
    throw new NetworkError(reason, detail);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 404) {
    throw new NotFoundError();
  }
  if (!response.ok) {
    // 401/403 (bad anon key / RLS) and 5xx all land here.
    throw new ServerError(response.status);
  }
  if (response.status === 204) {
    // PostgREST PATCH/DELETE without Prefer: return=representation.
    return undefined as T;
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new ServerError(response.status, 'Unreadable server response');
  }
}

/** GET a Supabase REST path. Never logs or leaks the path in errors. */
export async function supabaseGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET', headers: baseHeaders() });
}

/**
 * PATCH a Supabase REST path with a JSON body. Sends
 * `Prefer: return=representation` so the updated row comes back.
 */
export async function supabasePatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PATCH',
    headers: { ...baseHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
}
