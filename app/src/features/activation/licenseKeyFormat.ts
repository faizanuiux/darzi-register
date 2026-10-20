/**
 * License-key text handling shared by the Activation and Lock screens.
 *
 * WHY RAW STATE WHILE TYPING: both screens used to transform the text
 * inside onChangeText (uppercase / strip / insert dashes). On Samsung
 * Keyboard (and other composing IMEs) that makes the controlled value
 * diverge from the IME's in-progress composition — the native side
 * resets the composing region and typed characters are silently dropped
 * (paste still worked, because it commits the whole string at once).
 *
 * So the inputs now keep the user's RAW text in state while typing and
 * only normalize through formatLicenseKeyInput() on blur and on submit.
 * The formatter itself is total and monotonic: for any input, the
 * alphanumeric content of the output equals the input's alphanumeric
 * content (uppercased, capped at the 11 chars of a DRZ-XXXX-XXXX key).
 */

const KEY_ALPHANUMERICS = 11; // "DRZ" + 4 + 4

/** Uppercase alphanumerics of `raw`, capped at a full key's length. */
export function licenseKeyAlphanumerics(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, KEY_ALPHANUMERICS);
}

/**
 * Canonical DRZ-XXXX-XXXX display form of any raw input.
 * Idempotent: format(format(x)) === format(x).
 * Examples: "drz12345678" → "DRZ-1234-5678"; "DRZ-1234" → "DRZ-1234".
 */
export function formatLicenseKeyInput(raw: string): string {
  const clean = licenseKeyAlphanumerics(raw);
  const parts: string[] = [];
  if (clean.length > 0) {
    parts.push(clean.slice(0, 3));
  }
  if (clean.length > 3) {
    parts.push(clean.slice(3, 7));
  }
  if (clean.length > 7) {
    parts.push(clean.slice(7, KEY_ALPHANUMERICS));
  }
  return parts.join('-');
}
