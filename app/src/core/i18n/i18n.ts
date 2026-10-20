import {
  createContext,
  createElement,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { I18nManager } from 'react-native';
import { getSetting, setSetting } from '../storage/secureStorage';
import { en, type Strings } from '../../localization/en/common';
import { ur } from '../../localization/ur/common';

export type Language = 'en' | 'ur';

/**
 * Storage key for the persisted UI language. Persisted through the
 * resilient two-layer store (EncryptedStorage + SQLite `settings`
 * fallback) — NOT EncryptedStorage alone: on devices with a broken
 * Android Keystore every encrypted read throws, the language fell back
 * to English while I18nManager.forceRTL() (persisted natively) stayed
 * RTL, and the app rendered English text in a flipped RTL layout.
 */
export const LANGUAGE_STORAGE_KEY = 'drz_lang';

// RTL must be allowed before any layout happens. We keep it enabled globally;
// the active direction is switched per language below.
I18nManager.allowRTL(true);

const STRINGS: Record<Language, Strings> = { en, ur };

export function getStrings(lang: Language): Strings {
  return STRINGS[lang];
}

/** Simple `t` accessor: returns the full Strings object for a language. */
export function t(lang: Language): Strings {
  return getStrings(lang);
}

/**
 * Applies the layout direction for a language.
 *
 * NOTE: I18nManager.forceRTL() only takes FULL effect after the app reloads
 * (React Native limitation — the native view hierarchy caches direction).
 * We still call it immediately so newly mounted views follow the new
 * direction; a restart applies it everywhere.
 */
function applyDirection(lang: Language): void {
  const rtl = lang === 'ur';
  if (I18nManager.isRTL !== rtl) {
    I18nManager.forceRTL(rtl);
  }
}

interface LanguageContextValue {
  language: Language;
  /** True when the active language is a right-to-left language. */
  rtl: boolean;
  strings: Strings;
  setLanguage: (lang: Language) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  // Bumped at most once per launch to force a full remount of the tree
  // when the startup direction heal flips the native layout direction
  // (forceRTL alone only affects views mounted afterwards).
  const [treeKey, setTreeKey] = useState(0);
  const healedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // getSetting never throws; null = nothing readable in either layer.
      const saved = await getSetting(LANGUAGE_STORAGE_KEY);
      if (cancelled) {
        return;
      }
      const resolved: Language = saved === 'ur' ? 'ur' : 'en';
      const wasRTL = I18nManager.isRTL;
      setLanguageState(resolved);
      // ALWAYS apply the direction — including the default-English
      // fallback. Previously, when no saved language was found, the
      // native RTL flag was left as-is and English rendered flipped.
      applyDirection(resolved);
      if (wasRTL !== (resolved === 'ur') && !healedRef.current) {
        // The native direction disagreed with the resolved language
        // (the desync: keystore-broken language read vs natively
        // persisted forceRTL). forceRTL was just corrected above;
        // remount the tree once so every view rebuilds in the right
        // direction — a user stuck in the flipped state self-heals on
        // this launch with no manual steps.
        healedRef.current = true;
        setTreeKey((k) => k + 1);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    applyDirection(lang);
    // Two-layer persist; never throws — the language still applies for
    // this session even if both layers were unavailable.
    await setSetting(LANGUAGE_STORAGE_KEY, lang);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      rtl: language === 'ur',
      strings: getStrings(language),
      setLanguage,
    }),
    [language, setLanguage],
  );

  return createElement(
    LanguageContext.Provider,
    { value },
    createElement(Fragment, { key: treeKey }, children),
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used inside <LanguageProvider>.');
  }
  return ctx;
}

/** Returns the Strings object for the currently active language. */
export function useStrings(): Strings {
  return useLanguage().strings;
}
