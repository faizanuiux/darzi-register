import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { EmptyState, LoadingIndicator } from '../../components/feedback';
import { LockScreen } from '../../components/LockScreen';
import { useStrings } from '../../core/i18n/i18n';
import { useTheme } from '../../core/theme/ThemeProvider';
import { initDatabase, wireRepository } from '../../database';
import { setCustomerDataSource } from '../../features/customers/services/customerDataSource';
import { registerDevice } from '../../services/device/deviceService';
import {
  getStatus,
  isExpired,
  validate,
} from '../../services/licensing/licenseService';
import { RootNavigator } from '../navigation/RootNavigator';
import type { RootStackParamList } from '../navigation/types';

interface AppBootstrapProps {
  /** Returns true when the app is already activated. */
  checkActivation: () => Promise<boolean>;
}

type Phase = 'boot' | 'ready' | 'locked' | 'error';

type LockReason = 'expired' | 'disabled';

/**
 * Startup gate: initializes SQLite (migrations), wires the CustomerRepository
 * behind the CustomerDataSource contract, then routes to Activation or Main.
 */
export function AppBootstrap({ checkActivation }: AppBootstrapProps) {
  const { theme } = useTheme();
  const s = useStrings();
  const [phase, setPhase] = useState<Phase>('boot');
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList>('Activation');
  const [lockReason, setLockReason] = useState<LockReason>('expired');

  /** Mutable mirror of `phase` for the AppState listener (avoids re-subscribing). */
  const phaseRef = useRef<Phase>('boot');
  phaseRef.current = phase;

  const lock = useCallback((reason: LockReason) => {
    setLockReason(reason);
    setPhase('locked');
  }, []);

  const boot = useCallback(async () => {
    setPhase('boot');
    try {
      await initDatabase();
      const repo = await wireRepository();
      setCustomerDataSource(repo);

      const stored = await getStatus();
      if (stored) {
        // A stored activation exists: enforce expiry/disabled before entry.
        if (isExpired(stored)) {
          // Offline-expired: no network needed to know the license is done.
          lock('expired');
        } else {
          const result = await validate();
          if (result === 'disabled') {
            lock('disabled');
          } else if (result === 'expired') {
            lock('expired');
          } else if (result === 'invalid') {
            setInitialRoute('Activation');
            setPhase('ready');
          } else {
            // 'valid' or 'offline' (within grace) — enter the app.
            setInitialRoute('Main');
            setPhase('ready');
          }
        }
      } else {
        const activated = await checkActivation();
        setInitialRoute(activated ? 'Main' : 'Activation');
        setPhase('ready');
      }
      // Announce this installation to the admin dashboard only AFTER the UI
      // is up (best-effort, never blocks startup — the device appears in the
      // dashboard's Devices list even before any key is generated for it).
      void registerDevice();
    } catch {
      setPhase('error');
    }
  }, [checkActivation, lock]);

  useEffect(() => {
    void boot();
  }, [boot]);

  // Re-check the license whenever the app comes back to the foreground, so
  // an admin disable/expiry takes effect without an app restart. Never
  // throws — a failed re-check must not crash the app.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return;
      }
      if (phaseRef.current !== 'ready') {
        return;
      }
      void (async () => {
        try {
          const result = await validate();
          if (result === 'disabled') {
            lock('disabled');
          } else if (result === 'expired') {
            lock('expired');
          }
          // 'valid' / 'offline' / 'invalid' keep the current session running.
        } catch {
          // Swallow: gating must never crash the app.
        }
      })();
    });
    return () => {
      subscription.remove();
    };
  }, [lock]);

  if (phase === 'boot') {
    return <LoadingIndicator fullScreen label={s.common.loading} />;
  }

  if (phase === 'locked') {
    return <LockScreen reason={lockReason} onReactivated={() => void boot()} />;
  }

  if (phase === 'error') {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <EmptyState
          icon="⚠️"
          title={s.common.loading}
          actionLabel={s.common.retry}
          onAction={() => void boot()}
        />
      </View>
    );
  }

  return <RootNavigator initialRouteName={initialRoute} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
});
