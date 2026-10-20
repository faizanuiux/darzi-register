import "server-only";

import { createHash, randomInt } from "node:crypto";

/**
 * License-key primitives for the Darzi Register public API.
 *
 * Format: DRZ-XXXX-XXXX. The plaintext key lives ONLY in `licenses.key`;
 * everywhere else (logs, events, API responses) use `maskKey` output or the
 * stored `key_hint` column. NEVER Math.random for key material.
 */

/**
 * Ambiguous chars (0/O, 1/I, L) removed to avoid transcription errors.
 * NOTE: the task brief's literal alphabet string contained an "L", but the
 * brief's explicit rule was "no 0/O/1/I/L" — the rule wins. If any
 * pre-existing keys contain L, re-add L to KEY_REGEX below (accept side)
 * while keeping it out of generation here.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** The generation alphabet (unambiguous chars only). Exported for tests. */
export const KEY_ALPHABET = ALPHABET;

/**
 * Accept side is intentionally WIDER than the generation alphabet: existing
 * keys (issued by the old admin tool or the mobile app's own format check
 * `/^DRZ-[A-Z0-9]{4}-[A-Z0-9]{4}$/`) may contain 0/O/1/I/L. Generation above
 * still avoids ambiguous chars for new keys.
 */
const KEY_REGEX = /^DRZ-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

/** The canonical key pattern. Exported for tests and docs. */
export const KEY_PATTERN = KEY_REGEX;

/** Generate a fresh key, e.g. "DRZ-AB3D-F8KQ". Uses crypto.randomInt per char. */
export function generateLicenseKey(): string {
  let body = "";
  for (let i = 0; i < 8; i++) {
    body += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `DRZ-${body.slice(0, 4)}-${body.slice(4, 8)}`;
}

/** Trim + uppercase user-supplied key input before any comparison. */
export function normalizeKey(key: string): string {
  return key.trim().toUpperCase();
}

/**
 * True only for the exact DRZ-XXXX-XXXX format. Input is trimmed and
 * uppercased first, so surrounding whitespace / lowercase pass.
 * Accepts unknown input (returns false for non-strings).
 */
export function isValidKeyFormat(key: unknown): key is string {
  return typeof key === "string" && KEY_REGEX.test(key.trim().toUpperCase());
}

/**
 * SHA-256 hex of the normalized (trimmed + UPPERCASED) key. Matches the
 * `key_hash` backfill in 20261019_extend_licenses.sql
 * (encode(digest(upper(key), 'sha256'), 'hex')).
 */
export function hashKey(key: string): string {
  return createHash("sha256").update(normalizeKey(key)).digest("hex");
}

/** Masked form safe for logs/events/responses, e.g. "DRZ-••••-EFGH". */
export function maskKey(key: string): string {
  const normalized = normalizeKey(key);
  return `DRZ-••••-${normalized.slice(-4)}`;
}
