/**
 * Persistent storage for the license activation state — two layers.
 *
 * Primary: react-native-encrypted-storage (SharedPreferences encrypted with
 * the Android Keystore on Android, Keychain on iOS).
 *
 * Fallback: a plain key-value row in the app's own SQLite database
 * (`settings` table, schema v2).
 *
 * WHY: on some devices (notably Samsung / older Android) the Android
 * Keystore intermittently fails, making EVERY EncryptedStorage call throw.
 * Without a fallback, a successful server-side activation could never be
 * saved locally and the user was stuck on the activation screen forever
 * (previously misreported as a network error). With the fallback, the app
 * activates smoothly on every device; when the keystore later recovers,
 * reads heal the encrypted copy automatically.
 *
 * Customer data never lives here — only the activation record.
 */

import EncryptedStorage from 'react-native-encrypted-storage';
import { openDatabase } from '../../database';

const ACTIVATION_STORAGE_KEY = 'darzi.activation.v1';

/** What we keep locally after a successful activation. */
export interface ActivationState {
  /** Normalized license key (DRZ-XXXX-XXXX). Never logged. */
  key: string;
  /** Android ID the key was bound to at activation time. */
  deviceId: string;
  /** When activation completed, ISO 8601. */
  activatedAt: string;
  /** Last successful backend revalidation, ISO 8601. */
  lastValidatedAt: string;
  /**
   * License expiry mirrored from `licenses.expires_at`, ISO 8601.
   * Null = lifetime key (never expires). States stored before this field
   * existed parse as null.
   */
  expiresAt: string | null;
}

function isActivationState(value: unknown): value is ActivationState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  // expiresAt is optional here on purpose: payloads stored before the field
  // existed must still parse (they backfill as null = lifetime).
  return (
    typeof v.key === 'string' &&
    typeof v.deviceId === 'string' &&
    typeof v.activatedAt === 'string' &&
    typeof v.lastValidatedAt === 'string' &&
    (v.expiresAt === null ||
      v.expiresAt === undefined ||
      typeof v.expiresAt === 'string')
  );
}

/** Parse a stored payload; null when missing/corrupt (treated as none). */
function parseActivation(raw: string | null): ActivationState | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isActivationState(parsed)) {
      return null;
    }
    // Backfill payloads stored before expiresAt existed: missing → lifetime.
    return { ...parsed, expiresAt: parsed.expiresAt ?? null };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Layer 1: encrypted storage (Android Keystore / iOS Keychain).       */
/* Every call is wrapped — a broken keystore must never crash callers. */
/* ------------------------------------------------------------------ */

async function encryptedGet(key: string): Promise<string | null> {
  try {
    return await EncryptedStorage.getItem(key);
  } catch {
    return null;
  }
}

async function encryptedSet(key: string, value: string): Promise<boolean> {
  try {
    await EncryptedStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

async function encryptedRemove(key: string): Promise<boolean> {
  try {
    await EncryptedStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Layer 2: SQLite `settings` table fallback (no keystore involved).   */
/* ------------------------------------------------------------------ */

async function sqliteGet(key: string): Promise<string | null> {
  try {
    const db = await openDatabase();
    const result = await db.execute(
      'SELECT value FROM settings WHERE key = ?',
      [key],
    );
    const row = result.rows[0];
    const value = row ? row['value'] : null;
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

async function sqliteSet(key: string, value: string): Promise<boolean> {
  try {
    const db = await openDatabase();
    await db.execute(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [key, value],
    );
    return true;
  } catch {
    return false;
  }
}

async function sqliteRemove(key: string): Promise<boolean> {
  try {
    const db = await openDatabase();
    await db.execute('DELETE FROM settings WHERE key = ?', [key]);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Public API — same signatures as before, now failure-resilient.      */
/* ------------------------------------------------------------------ */

/**
 * Persist the activation state after a successful activation.
 * Attempts BOTH layers (keeps the fallback copy current in case the
 * keystore breaks later); throws only when both layers fail.
 */
export async function saveActivation(state: ActivationState): Promise<void> {
  const serialized = JSON.stringify(state);
  const [encryptedOk, sqliteOk] = await Promise.all([
    encryptedSet(ACTIVATION_STORAGE_KEY, serialized),
    sqliteSet(ACTIVATION_STORAGE_KEY, serialized),
  ]);
  if (!encryptedOk && !sqliteOk) {
    throw new Error(
      'Could not save activation: secure storage and database both failed',
    );
  }
}

/**
 * Read the stored activation state, or null when none exists.
 * Encrypted storage is checked first; when it is empty/broken the SQLite
 * fallback is consulted, and a successful fallback read heals the
 * encrypted copy so later reads use the primary layer again. Reads that
 * fail in both layers return null (treated as "no activation").
 */
export async function getActivation(): Promise<ActivationState | null> {
  const fromEncrypted = parseActivation(await encryptedGet(ACTIVATION_STORAGE_KEY));
  if (fromEncrypted) {
    return fromEncrypted;
  }
  const rawFallback = await sqliteGet(ACTIVATION_STORAGE_KEY);
  const fromFallback = parseActivation(rawFallback);
  if (fromFallback && rawFallback) {
    // Keystore is back (or was never the holder) — restore the primary
    // copy. Best-effort: failing to heal must not fail the read.
    void encryptedSet(ACTIVATION_STORAGE_KEY, rawFallback);
    return fromFallback;
  }
  return null;
}

/**
 * Remove the stored activation (used on key revocation / sign-out).
 * Attempts both layers; throws only when both fail.
 */
export async function clearActivation(): Promise<void> {
  const [encryptedOk, sqliteOk] = await Promise.all([
    encryptedRemove(ACTIVATION_STORAGE_KEY),
    sqliteRemove(ACTIVATION_STORAGE_KEY),
  ]);
  if (!encryptedOk && !sqliteOk) {
    throw new Error(
      'Could not clear activation: secure storage and database both failed',
    );
  }
}

/* ------------------------------------------------------------------ */
/* Generic settings API — same two layers, for small non-secret        */
/* preferences (e.g. the UI language, `drz_lang`). Both functions are  */
/* total: they NEVER throw, on any device.                             */
/* ------------------------------------------------------------------ */

/**
 * Read a setting. Encrypted storage first; on a miss/failure the SQLite
 * fallback is consulted and a fallback hit heals the encrypted copy.
 * Returns null when the setting exists in neither layer.
 */
export async function getSetting(key: string): Promise<string | null> {
  const fromEncrypted = await encryptedGet(key);
  if (fromEncrypted !== null) {
    return fromEncrypted;
  }
  const fromSqlite = await sqliteGet(key);
  if (fromSqlite !== null) {
    // Best-effort heal, same as getActivation.
    void encryptedSet(key, fromSqlite);
    return fromSqlite;
  }
  return null;
}

/**
 * Write a setting to BOTH layers (keeps the fallback copy current in
 * case the keystore breaks later). Succeeds silently if at least the
 * intent was attempted — callers must not depend on a throw.
 */
export async function setSetting(key: string, value: string): Promise<void> {
  await Promise.all([encryptedSet(key, value), sqliteSet(key, value)]);
}
