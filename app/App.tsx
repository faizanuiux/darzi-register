import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppBootstrap } from './src/app/bootstrap/AppBootstrap';
import { ToastProvider } from './src/components/feedback';
import { RootErrorBoundary } from './src/components/feedback/RootErrorBoundary';
import { LanguageProvider } from './src/core/i18n/i18n';
import { ThemeProvider } from './src/core/theme/ThemeProvider';
import { ENV } from './src/core/config/env';

/**
 * Real activation check: reads the securely stored activation state and
 * verifies it is within the offline grace period. Detailed revalidation
 * happens inside the activation screen / hook.
 */
async function checkActivation(): Promise<boolean> {
  try {
    const { getStatus } = await import('./src/services/licensing/licenseService');
    const stored = await getStatus();
    if (!stored) {
      return false;
    }
    const ageMs = Date.now() - Date.parse(stored.activatedAt);
    return !Number.isNaN(ageMs) && ageMs <= ENV.licenseOfflineGraceDays * 86_400_000;
  } catch {
    return false;
  }
}

export default function App() {
  return (
    <RootErrorBoundary>
      <SafeAreaProvider>
        <LanguageProvider>
          <ThemeProvider>
            <ToastProvider>
              <StatusBar barStyle="dark-content" />
              <AppBootstrap checkActivation={checkActivation} />
            </ToastProvider>
          </ThemeProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </RootErrorBoundary>
  );
}
