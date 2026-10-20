/**
 * Unit tests for the license service.
 *
 * fetch is mocked (never hits Supabase) and react-native-encrypted-storage is
 * replaced with an in-memory store. No license key ever leaves this process.
 */

import EncryptedStorage from 'react-native-encrypted-storage';
import {
  activate,
  validate,
  getStatus,
  LicenseError,
} from '../../src/services/licensing/licenseService';

jest.mock('react-native-encrypted-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(),
    getItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
}));

const storage = EncryptedStorage as unknown as {
  setItem: jest.Mock;
  getItem: jest.Mock;
  removeItem: jest.Mock;
  clear: jest.Mock;
};

// Replace the real fetch with a jest mock so no request ever leaves jest.
(globalThis.fetch as unknown) = jest.fn();
const fetchMock = globalThis.fetch as unknown as jest.Mock;

// In-memory encrypted-storage stand-in.
const store = new Map<string, string>();

interface MockResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

function jsonResponse(status: number, body: unknown): Promise<MockResponse> {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    key: 'DRZ-ABCD-1234',
    customer_name: null,
    used: false,
    device_id: null,
    created_at: '2026-10-01T00:00:00.000Z',
    activated_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  store.clear();
  fetchMock.mockReset();
  storage.setItem.mockReset().mockImplementation(async (k: string, v: string) => {
    store.set(k, v);
  });
  storage.getItem.mockReset().mockImplementation(async (k: string) => {
    return store.has(k) ? (store.get(k) as string) : null;
  });
  storage.removeItem.mockReset().mockImplementation(async (k: string) => {
    store.delete(k);
  });
  storage.clear.mockReset().mockImplementation(async () => {
    store.clear();
  });
});

async function expectLicenseError(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(LicenseError);
    expect((err as LicenseError).code).toBe(code);
    return;
  }
  throw new Error(`Expected LicenseError(${code}) but the promise resolved`);
}

describe('activate', () => {
  test('rejects an invalid key format client-side without calling fetch', async () => {
    await expectLicenseError(activate('not-a-real-key', 'device-1'), 'format');
    await expectLicenseError(activate('DRZ-ABC-123', 'device-1'), 'format');
    await expectLicenseError(activate('', 'device-1'), 'format');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('valid activation issues the correct PATCH and stores state', async () => {
    const row = makeRow();
    fetchMock
      .mockReturnValueOnce(jsonResponse(200, [row]))
      .mockReturnValueOnce(
        jsonResponse(200, [
          { ...row, used: true, device_id: 'device-1', activated_at: '2026-10-19T00:00:00.000Z' },
        ]),
      );

    // Lowercase input must be normalized before the format check.
    const state = await activate('drz-abcd-1234', 'device-1');

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [patchUrl, patchInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(patchUrl).toContain('key=eq.DRZ-ABCD-1234');
    expect(patchInit.method).toBe('PATCH');
    const headers = patchInit.headers as Record<string, string>;
    expect(headers.Prefer).toBe('return=representation');
    const body = JSON.parse(patchInit.body as string) as Record<string, unknown>;
    expect(body.used).toBe(true);
    expect(body.device_id).toBe('device-1');
    expect(typeof body.activated_at).toBe('string');
    expect(Number.isNaN(Date.parse(body.activated_at as string))).toBe(false);

    expect(state.key).toBe('DRZ-ABCD-1234');
    expect(state.deviceId).toBe('device-1');

    // Secure storage now holds the activation.
    const stored = await getStatus();
    expect(stored).not.toBeNull();
    expect(stored?.key).toBe('DRZ-ABCD-1234');
    expect(stored?.deviceId).toBe('device-1');
  });

  test("throws 'used' when the key is bound to a different device", async () => {
    fetchMock.mockReturnValueOnce(
      jsonResponse(200, [makeRow({ used: true, device_id: 'other-device' })]),
    );

    await expectLicenseError(activate('DRZ-ABCD-1234', 'device-1'), 'used');
    // No PATCH must be issued for a foreign key.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const stored = await getStatus();
    expect(stored).toBeNull();
  });

  test('same-device reactivation succeeds', async () => {
    fetchMock.mockReturnValueOnce(
      jsonResponse(200, [
        makeRow({
          used: true,
          device_id: 'device-1',
          activated_at: '2026-10-10T00:00:00.000Z',
        }),
      ]),
    );

    const state = await activate('DRZ-ABCD-1234', 'device-1');

    // Already bound to this device — no PATCH rewrite needed.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(state.key).toBe('DRZ-ABCD-1234');
    expect(state.activatedAt).toBe('2026-10-10T00:00:00.000Z');
    const stored = await getStatus();
    expect(stored?.deviceId).toBe('device-1');
  });

  test("unknown key (empty result) throws 'invalid'", async () => {
    fetchMock.mockReturnValueOnce(jsonResponse(200, []));
    await expectLicenseError(activate('DRZ-ZZZZ-9999', 'device-1'), 'invalid');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("network failure throws 'network'", async () => {
    fetchMock.mockRejectedValueOnce(new Error('socket hang up'));
    await expectLicenseError(activate('DRZ-ABCD-1234', 'device-1'), 'network');

    // A server 500 is equally retryable — also 'network'.
    fetchMock.mockReturnValueOnce(jsonResponse(500, { message: 'boom' }));
    await expectLicenseError(activate('DRZ-ABCD-1234', 'device-1'), 'network');
  });
});

describe('validate', () => {
  test("returns 'offline' when the network fails within the grace period", async () => {
    const now = new Date().toISOString();
    store.set(
      'darzi.activation.v1',
      JSON.stringify({
        key: 'DRZ-ABCD-1234',
        deviceId: 'device-1',
        activatedAt: now,
        lastValidatedAt: now,
      }),
    );
    fetchMock.mockRejectedValueOnce(new Error('offline'));

    expect(await validate()).toBe('offline');
  });

  test("returns 'disabled' and clears storage when the key moved to another device", async () => {
    const now = new Date().toISOString();
    store.set(
      'darzi.activation.v1',
      JSON.stringify({
        key: 'DRZ-ABCD-1234',
        deviceId: 'device-1',
        activatedAt: now,
        lastValidatedAt: now,
      }),
    );
    fetchMock.mockReturnValueOnce(
      jsonResponse(200, [
        makeRow({ used: true, device_id: 'a-different-phone' }),
      ]),
    );

    expect(await validate()).toBe('disabled');
    expect(await getStatus()).toBeNull();
  });
});
