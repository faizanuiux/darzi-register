/**
 * useActivation — gate hook for the app.
 *
 * On mount: reads encrypted storage for a stored activation.
 * - Present and within the offline grace window → status 'active'
 *   immediately; a background revalidation runs against the backend when
 *   reachable, and demotes to 'needs-activation' on 'invalid'/'disabled'.
 * - Missing, expired, or invalid → 'needs-activation'.
 *
 * The app renders <ActivationScreen> while status is 'needs-activation'.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ENV } from '../../../core/config/env';
import { sanitizeErrorDetail } from '../../../core/api/supabase';
import { getDeviceId } from '../../../services/device/deviceService';
import {
  activate as activateLicense,
  validate as validateLicense,
  getStatus as getStoredStatus,
  LicenseError,
} from '../../../services/licensing/licenseService';
import type { ActivationError, ActivationStatus, UseActivation } from '../types';

const MILLISECONDS_PER_DAY = 86_400_000;

function withinGrace(activatedAt: string): boolean {
  const activatedMs = Date.parse(activatedAt);
  if (Number.isNaN(activatedMs)) {
    return false;
  }
  return Date.now() - activatedMs <= ENV.licenseOfflineGraceDays * MILLISECONDS_PER_DAY;
}

export function useActivation(): UseActivation {
  const [status, setStatus] = useState<ActivationStatus>('checking');
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<ActivationError | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;

    (async () => {
      let id: string | null = null;
      try {
        id = await getDeviceId();
      } catch {
        id = null;
      }
      if (cancelled || !mounted.current) {
        return;
      }
      setDeviceId(id);

      try {
        const stored = await getStoredStatus();
        if (cancelled || !mounted.current) {
          return;
        }
        if (stored && withinGrace(stored.activatedAt)) {
          setStatus('active');
          // Background revalidation — silent unless it fails hard.
          validateLicense().then((result) => {
            if (!mounted.current || cancelled) {
              return;
            }
            if (result === 'invalid' || result === 'disabled') {
              setStatus('needs-activation');
            }
          });
        } else {
          setStatus('needs-activation');
        }
      } catch {
        // Storage read failure → treat as needing activation.
        if (mounted.current && !cancelled) {
          setStatus('needs-activation');
        }
      }
    })();

    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, []);

  const activate = useCallback(
    async (key: string): Promise<void> => {
      setError(null);
      setErrorDetail(null);
      if (key.trim().length === 0) {
        setError('empty');
        return;
      }
      let id = deviceId;
      if (!id) {
        try {
          id = await getDeviceId();
          if (mounted.current) {
            setDeviceId(id);
          }
        } catch (err) {
          // Local device failure (not a server problem) — report it as a
          // storage/device error with the real reason, never as 'network'.
          setError('storage');
          setErrorDetail(
            err instanceof Error
              ? sanitizeErrorDetail(`${err.name}: ${err.message}`)
              : null,
          );
          return;
        }
      }
      setIsLoading(true);
      try {
        await activateLicense(key, id);
        if (mounted.current) {
          setStatus('active');
        }
      } catch (err) {
        if (!mounted.current) {
          return;
        }
        if (err instanceof LicenseError) {
          setError(err.code === 'format' ? 'invalid' : err.code);
          // Carry the real underlying reason for network failures so the
          // screen can show it as a small diagnostic line.
          setErrorDetail(
            err.code === 'network' ? (err.detail ?? null) : null,
          );
        } else {
          // NOT a license judgement at all — a local failure (e.g. the
          // activation could not be saved on this device). Surface it as
          // 'storage' with the real reason; never call it a network error.
          setError('storage');
          setErrorDetail(
            err instanceof Error
              ? sanitizeErrorDetail(`${err.name}: ${err.message}`)
              : null,
          );
        }
      } finally {
        if (mounted.current) {
          setIsLoading(false);
        }
      }
    },
    [deviceId],
  );

  return { status, deviceId, activate, error, errorDetail, isLoading };
}
