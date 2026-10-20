/**
 * License service: activation, revalidation, and activation-status reads.
 *
 * FLOW:
 * 1. activate(key, deviceId) — client-side format check first, then GET the
 *    row from Supabase, enforce one-key-one-device binding, PATCH
 *    used=true/device_id/activated_at, and persist the activation state in
 *    encrypted storage. Activation needs internet exactly once.
 * 2. validate() — re-checks the stored key against the backend. Returns
 *    'offline' when the network is down but the cached activation is within
 *    the grace window (ENV.licenseOfflineGraceDays, default 30 days).
 * 3. getStatus() — reads the locally stored activation state (or null).
 *
 * One-key-one-device rule: a row with used=true bound to a DIFFERENT
 * device_id rejects activation with LicenseError('used'). The same device
 * reactivating (e.g. after app data was cleared) succeeds without error.
 *
 * PRIVACY: the app only ever touches key/used/device_id/activated_at/
 * expires_at/enabled. Customer data (customer_name) is never sent to
 * Supabase.
 * SECURITY: license keys never appear in logs or error messages.
 */

import {
  supabaseGet,
  supabasePatch,
  NetworkError,
  NotFoundError,
  ServerError,
  sanitizeErrorDetail,
} from '../../core/api/supabase';
import type {
  LicenseRow,
  ActivateRequest,
  ActivateResponse,
  LicenseValidationResult,
} from '../../core/api/dto';
import { ENV } from '../../core/config/env';
import {
  saveActivation,
  getActivation,
  clearActivation,
} from '../../core/storage/secureStorage';
import type { ActivationState } from '../../core/storage/secureStorage';

export type LicenseErrorCode =
  | 'invalid'
  | 'used'
  | 'expired'
  | 'disabled'
  | 'network'
  | 'format'
  | 'conflict';

export class LicenseError extends Error {
  readonly code: LicenseErrorCode;
  /**
   * Sanitized technical detail for 'network' failures (underlying fetch
   * error name + message, or "Server responded <status>"). Never contains
   * the license key or URL query strings.
   */
  readonly detail?: string;
  constructor(code: LicenseErrorCode, detail?: string) {
    super(`License error: ${code}`);
    this.name = 'LicenseError';
    this.code = code;
    this.detail = detail ? sanitizeErrorDetail(detail) : undefined;
  }
}

/**
 * Build a 'network' LicenseError that carries the real underlying reason,
 * so on-device diagnostics can distinguish DNS failures, TLS errors,
 * timeouts, and genuine server responses.
 */
function networkErrorFrom(err: unknown): LicenseError {
  if (err instanceof NetworkError) {
    return new LicenseError('network', err.detail ?? err.message);
  }
  if (err instanceof ServerError) {
    return new LicenseError('network', `Server responded ${err.status}`);
  }
  return new LicenseError('network');
}

/** Client-side key shape: DRZ- + 4 + 4 uppercase alphanumerics. */
export const LICENSE_KEY_PATTERN = /^DRZ-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

const MILLISECONDS_PER_DAY = 86_400_000;

/**
 * True when the ISO expiry timestamp is set and in the past.
 * Null = lifetime = never expires. Unparseable values are treated as not
 * expired (fail-open for local gating; the backend check decides online).
 */
function isExpiryInPast(expiresAt: string | null): boolean {
  if (expiresAt === null) {
    return false;
  }
  const ms = Date.parse(expiresAt);
  return !Number.isNaN(ms) && ms <= Date.now();
}

/**
 * Whether the stored activation has expired. Works fully offline: null
 * `expiresAt` is a lifetime key and never expires.
 */
export function isExpired(state: ActivationState): boolean {
  return isExpiryInPast(state.expiresAt);
}

/** True when the backend row's expiry has passed (null = lifetime). */
function isRowExpired(row: LicenseRow): boolean {
  return isExpiryInPast(row.expires_at);
}

function licenseRowPath(normalizedKey: string): string {
  // The key is already restricted to [A-Z0-9-] by the format check, so it is
  // URL-safe; encodeURIComponent keeps it safe even if the pattern changes.
  return `/rest/v1/licenses?key=eq.${encodeURIComponent(
    normalizedKey,
  )}&select=*`;
}

function isGraceExpired(state: ActivationState): boolean {
  const activatedMs = Date.parse(state.activatedAt);
  if (Number.isNaN(activatedMs)) {
    return true;
  }
  const ageDays = (Date.now() - activatedMs) / MILLISECONDS_PER_DAY;
  return ageDays > ENV.licenseOfflineGraceDays;
}

/**
 * Release any OTHER license row currently bound to this device.
 *
 * The licenses table has a unique constraint on device_id (one key per
 * device). When a customer renews — old key expired, new key bought — the
 * old row still points at the device and binding the new key is rejected
 * with HTTP 409. Clearing the old row's binding first makes the renewal
 * bind succeed.
 *
 * Best-effort: failures are swallowed on purpose. If the release did not
 * happen, the bind PATCH below surfaces the real error (409 → 'conflict',
 * transport failures → 'network' with detail).
 */
async function releaseOtherKeyBoundToDevice(
  deviceId: string,
  keepKey: string,
): Promise<void> {
  try {
    const boundRows = await supabaseGet<Array<{ key: string }>>(
      `/rest/v1/licenses?device_id=eq.${encodeURIComponent(
        deviceId,
      )}&select=key`,
    );
    const other = boundRows.find((r) => r.key !== keepKey);
    if (!other) {
      return;
    }
    await supabasePatch<ActivateResponse>(licenseRowPath(other.key), {
      used: false,
      device_id: null,
      activated_at: null,
    });
  } catch {
    // Deliberately ignored — see docblock.
  }
}

/**
 * Activate a license key for this device.
 *
 * @throws LicenseError('format')   — key fails the client-side format check
 * @throws LicenseError('invalid')  — no such key exists
 * @throws LicenseError('used')     — key is bound to a different device
 * @throws LicenseError('expired')  — key's expires_at has already passed
 * @throws LicenseError('disabled') — key was disabled from the admin dashboard
 * @throws LicenseError('network')  — network down or server error
 * @throws LicenseError('conflict') — device still holds another key after
 *                                    the release step (unique-constraint race)
 */
export async function activate(
  key: string,
  deviceId: string,
): Promise<ActivationState> {
  const normalizedKey = key.trim().toUpperCase();
  if (!LICENSE_KEY_PATTERN.test(normalizedKey)) {
    throw new LicenseError('format');
  }

  let rows: LicenseRow[];
  try {
    rows = await supabaseGet<LicenseRow[]>(licenseRowPath(normalizedKey));
  } catch (err) {
    if (err instanceof NotFoundError) {
      throw new LicenseError('invalid');
    }
    // NetworkError and ServerError both behave like a network problem for
    // the user (retryable, never a judgement about the key itself) — but
    // the thrown error now carries the real underlying reason as `detail`.
    throw networkErrorFrom(err);
  }

  const row = rows[0];
  if (!row) {
    // PostgREST returns [] instead of 404 for filtered reads.
    throw new LicenseError('invalid');
  }

  if (row.used && row.device_id !== null && row.device_id !== deviceId) {
    throw new LicenseError('used');
  }

  if (row.enabled === false) {
    throw new LicenseError('disabled');
  }

  if (isRowExpired(row)) {
    throw new LicenseError('expired');
  }

  const nowIso = new Date().toISOString();
  const alreadyBoundToThisDevice = row.used && row.device_id === deviceId;

  if (!alreadyBoundToThisDevice) {
    // Renewal case: this device may still hold a DIFFERENT (old) key. The
    // licenses table enforces one row per device_id (unique constraint),
    // so binding the new key while the old row still points at this device
    // fails with HTTP 409. Release the old row first, then bind.
    await releaseOtherKeyBoundToDevice(deviceId, normalizedKey);

    const body: ActivateRequest = {
      used: true,
      device_id: deviceId,
      activated_at: nowIso,
    };
    try {
      await supabasePatch<ActivateResponse>(licenseRowPath(normalizedKey), body);
    } catch (err) {
      // A 409 here means the device STILL holds another key (e.g. the
      // release raced a concurrent write) — surface it as its own error
      // instead of a misleading network failure.
      if (err instanceof ServerError && err.status === 409) {
        throw new LicenseError('conflict');
      }
      // Transport and other server failures behave the same for the user:
      // retryable, never a judgement about the key itself. The real reason
      // rides along as `detail` for on-device diagnosis.
      throw networkErrorFrom(err);
    }
  }

  // Re-read the row so the persisted state carries the backend's expiry
  // (expires_at is set from the admin dashboard and can change there).
  let freshRow: LicenseRow | undefined;
  try {
    const freshRows = await supabaseGet<LicenseRow[]>(
      licenseRowPath(normalizedKey),
    );
    freshRow = freshRows[0];
  } catch {
    // If the re-read fails, fall back to the pre-PATCH row — expires_at is
    // never mutated by the activation PATCH itself.
  }
  const finalRow = freshRow ?? row;

  const state: ActivationState = {
    key: normalizedKey,
    deviceId,
    activatedAt: finalRow.activated_at ?? nowIso,
    lastValidatedAt: nowIso,
    expiresAt: finalRow.expires_at ?? null,
  };
  await saveActivation(state);
  return state;
}

/**
 * Re-check the stored activation against the backend.
 *
 * Returns:
 * - 'valid'    — key exists, is enabled, not expired, and is bound to this
 *                device (or unused on the backend, which the app treats as
 *                valid)
 * - 'invalid'  — no stored activation, key no longer exists, or the cached
 *                activation is past the offline grace period
 * - 'disabled' — key is now bound to a DIFFERENT device (moved or reassigned
 *                from the admin dashboard; local state is cleared) OR the key
 *                was disabled from the admin dashboard (local state is KEPT
 *                so the lock screen can show the key hint)
 * - 'expired'  — row's expires_at has passed; local state is KEPT so the
 *                lock screen can show the key hint
 * - 'offline'  — network/server unreachable but cached activation is within
 *                the grace window
 */
export async function validate(): Promise<LicenseValidationResult> {
  const state = await getActivation();
  if (!state) {
    return 'invalid';
  }

  let rows: LicenseRow[];
  try {
    rows = await supabaseGet<LicenseRow[]>(licenseRowPath(state.key));
  } catch {
    // Any transport/server failure → offline as long as we're in grace.
    return isGraceExpired(state) ? 'invalid' : 'offline';
  }

  const row = rows[0];
  if (!row) {
    await clearActivation();
    return 'invalid';
  }

  if (row.enabled === false) {
    // Admin-disabled key: do NOT clear — the lock screen needs the key hint.
    return 'disabled';
  }

  if (isRowExpired(row)) {
    // Expired: do NOT clear — the lock screen needs the key hint. Refresh
    // the cached expiry so offline gating stays consistent (also backfills
    // activations stored before expiresAt existed).
    const expiredState: ActivationState = {
      ...state,
      lastValidatedAt: new Date().toISOString(),
      expiresAt: row.expires_at,
    };
    await saveActivation(expiredState);
    return 'expired';
  }

  if (row.used && row.device_id !== null && row.device_id !== state.deviceId) {
    // Key was reassigned to another device — this device loses access.
    await clearActivation();
    return 'disabled';
  }

  const refreshed: ActivationState = {
    ...state,
    lastValidatedAt: new Date().toISOString(),
    // Backfills old activations and picks up dashboard expiry changes.
    expiresAt: row.expires_at ?? null,
  };
  await saveActivation(refreshed);
  return 'valid';
}

/** Read the stored activation state, or null when never activated. */
export async function getStatus(): Promise<ActivationState | null> {
  return getActivation();
}

/**
 * Settings license-card data contract (consumed by the settings UI team).
 * Offline-only: derived purely from the stored activation state, never hits
 * the network, and never mutates anything (validate() can lock/clear, so the
 * card must not call it).
 */
export interface LicenseCardInfo {
  /** Masked key, e.g. "DRZ-••••-WUTM": keep the DRZ- prefix, mask the middle, keep last 4 chars. */
  keyHint: string;
  /** Ceiling days until expiry; null for lifetime keys. */
  daysRemaining: number | null;
  /** True when expiresAt is null (never expires). */
  isLifetime: boolean;
  /** When the key was activated, ISO 8601, or null. */
  activatedAt: string | null;
  /** 'active' | 'expired' from cached state only ('disabled' is never returned here). */
  status: 'active' | 'expired' | 'disabled';
}

/**
 * Mask a normalized DRZ-XXXX-XXXX key as "DRZ-••••-XXXX": keep the DRZ-
 * prefix, mask every non-dash char of the middle segment, keep the last 4.
 */
function maskKeyHint(key: string): string {
  const PREFIX = 'DRZ-';
  const tail = key.slice(-4);
  const middle = key.startsWith(PREFIX)
    ? key.slice(PREFIX.length, key.length - 4)
    : key.slice(0, key.length - 4);
  const maskedMiddle = middle.replace(/[^-]/g, '•');
  return `${PREFIX}${maskedMiddle}${tail}`;
}

/** Returns null when no activation is stored. */
export async function getLicenseCardInfo(): Promise<LicenseCardInfo | null> {
  const state = await getActivation();
  if (!state) {
    return null;
  }
  const expired = isExpired(state);
  const isLifetime = state.expiresAt === null;
  let daysRemaining: number | null = null;
  if (!isLifetime) {
    const expiresMs = Date.parse(state.expiresAt as string);
    if (!Number.isNaN(expiresMs)) {
      daysRemaining = Math.ceil(
        (expiresMs - Date.now()) / MILLISECONDS_PER_DAY,
      );
    }
  }
  return {
    keyHint: maskKeyHint(state.key),
    daysRemaining,
    isLifetime,
    activatedAt: state.activatedAt ?? null,
    status: expired ? 'expired' : 'active',
  };
}
