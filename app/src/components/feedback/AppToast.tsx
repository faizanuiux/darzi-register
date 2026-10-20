import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useTheme } from '../../core/theme/ThemeProvider';

const TOAST_DURATION_MS = 2500;

interface ToastContextValue {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Minimal toast system. Wrap the app (or a navigator subtree) in
 * <ToastProvider> and call showToast(message) from useToast().
 * Only one toast is shown at a time; it auto-dismisses.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const { colors, spacing, radius, fontSize, fontFamily } = theme;
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setMessage(null));
  }, [opacity]);

  const showToast = useCallback(
    (next: string) => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
      setMessage(next);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      timer.current = setTimeout(hide, TOAST_DURATION_MS);
    },
    [hide, opacity],
  );

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              opacity,
              backgroundColor: colors.ink,
              borderRadius: radius.pill,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.lg,
              bottom: spacing.xxl * 2,
            },
          ]}>
          <Text
            style={[
              styles.text,
              { color: colors.background, fontSize: fontSize.sm, fontFamily: fontFamily.medium },
            ]}
            numberOfLines={2}>
            {message}
          </Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>.');
  }
  return ctx;
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '85%',
    elevation: 6,
  },
  text: {
    textAlign: 'center',
  },
});
