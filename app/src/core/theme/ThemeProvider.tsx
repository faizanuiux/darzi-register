import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { darkTheme, lightTheme, type Theme } from './tokens';

interface ThemeContextValue {
  theme: Theme;
  /** True when the dark theme is active. */
  dark: boolean;
  setDark: (dark: boolean) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Default: light theme. The settings screen will expose the toggle later.
  const [dark, setDark] = useState(false);

  const toggleTheme = useCallback(() => {
    setDark(prev => !prev);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: dark ? darkTheme : lightTheme,
      dark,
      setDark,
      toggleTheme,
    }),
    [dark, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>.');
  }
  return ctx;
}
