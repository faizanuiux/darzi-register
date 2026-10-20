/**
 * Activation feature types.
 */

import type { LicenseErrorCode } from '../../services/licensing/licenseService';

/** Lifecycle status of the app's license. */
export type ActivationStatus = 'checking' | 'needs-activation' | 'active';

/**
 * Error surfaced by the useActivation hook. Mirrors LicenseErrorCode, plus
 * 'empty' for a blank key field; LicenseError('format') is mapped to
 * 'invalid' so the UI has one message for "check your key". 'storage'
 * covers LOCAL device failures that are not license judgements at all
 * (e.g. the device could not save the activation) — these must never be
 * reported as network errors.
 */
export type ActivationError =
  | Exclude<LicenseErrorCode, 'format'>
  | 'empty'
  | 'storage';

export interface UseActivation {
  /** Current activation status; 'checking' while the stored state is read. */
  status: ActivationStatus;
  /** Device ID once resolved, null while loading or unavailable. */
  deviceId: string | null;
  /** Attempt activation with the given key. Throws nothing — errors land in `error`. */
  activate: (key: string) => Promise<void>;
  /** Localizable error for the last failed activation, null otherwise. */
  error: ActivationError | null;
  /**
   * Sanitized technical detail for the last 'network' or 'storage' error
   * (underlying fetch/storage error or server status), shown small under
   * the friendly message for on-device diagnosis. Null for other errors.
   * Language-neutral, never contains the license key.
   */
  errorDetail: string | null;
  /** True while activation is in flight. */
  isLoading: boolean;
}
