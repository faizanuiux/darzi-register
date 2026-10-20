/**
 * Device identity service.
 *
 * The device ID is the **Android ID** (`Settings.Secure.ANDROID_ID` via
 * react-native-device-info's getAndroidId()).
 *
 * WHAT IT IS / ISN'T:
 * - It is NOT the IMEI, serial number, or MAC address — those require
 *   privileged permissions (READ_PHONE_STATE etc.) and are unavailable to
 *   normal apps on modern Android.
 * - The Android ID is app-scoped on Android 8+: unique per (app signing key,
 *   user, device) tuple. A factory reset, or the user wiping all data,
 *   changes it. It survives app reinstalls by the same user.
 * - It is stable enough for one-license-one-phone binding, but NOT a
 *   hardware fingerprint. Boss should know: a factory reset unbinds the
 *   license and the key must be reactivated (same key, same device ID value
 *   will differ → the admin dashboard can reset `used`/`device_id`).
 *
 * The value is cached in memory after the first read.
 */

import {
  getAndroidId,
  getManufacturer,
  getModel,
  getSystemVersion,
} from 'react-native-device-info';
import { ENV } from '../../core/config/env';

export class DeviceInfoError extends Error {
  constructor(message = 'Unable to determine device ID') {
    super(message);
    this.name = 'DeviceInfoError';
  }
}

let cachedDeviceId: string | null = null;

/**
 * Returns the device's Android ID. Cached in memory; the native call only
 * happens once per app session. Throws DeviceInfoError when unavailable.
 */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) {
    return cachedDeviceId;
  }
  let id: string;
  try {
    id = await getAndroidId();
  } catch {
    throw new DeviceInfoError();
  }
  if (!id) {
    throw new DeviceInfoError();
  }
  cachedDeviceId = id;
  return id;
}

/** Test/debug helper — clears the in-memory cache. */
export function clearDeviceIdCache(): void {
  cachedDeviceId = null;
}

/**
 * Registers this device with the Darzi Register admin dashboard backend
 * (`POST /api/devices/register`). The dashboard lists the device even before
 * any license key is generated for it, so the admin can issue a device-bound
 * key from the Devices page.
 *
 * Idempotent server-side — safe to call on every launch. Best-effort: never
 * throws, never blocks startup. If the device is offline or the dashboard is
 * unreachable, the call is silently skipped and retried on the next launch.
 */
export async function registerDevice(): Promise<void> {
  try {
    const deviceId = await getDeviceId();
    const manufacturer = await getManufacturer().catch(() => '');
    // getModel/getSystemVersion are synchronous in device-info v15 — wrap in
    // try/catch instead of promise .catch().
    let model = '';
    let androidVersion = '';
    try {
      model = getModel();
    } catch {
      // leave blank
    }
    try {
      androidVersion = getSystemVersion();
    } catch {
      // leave blank
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      await fetch(`${ENV.dashboardUrl}/api/devices/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          manufacturer: manufacturer || undefined,
          model: model || undefined,
          android_version: androidVersion || undefined,
          app_version: ENV.appVersion,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // Registration is best-effort; the app works fully offline regardless.
  }
}
