import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { I18nManager, type ViewStyle } from 'react-native';
import { getSetting, setSetting } from '../storage/secureStorage';
import { en, type Strings } from '../../localization/en/common';
import { ur } from '../../localization/ur/common';

export type Language = 'en' | 'ur';

/**
 * Storage key for the persisted UI language. Persisted through the
 * resilient two-layer store (EncryptedStorage + SQLite `settings`
 * fallback) — NOT EncryptedStorage alone: on devices with a broken
 * Android Keystore every encrypted read throws and the language fell
 * back to the default while any natively persisted direction stayed
 * behind, desyncing text language from layout direction.
 */
export const LANGUAGE_STORAGE_KEY = 'drz_lang';

/**
 * Layout direction is owned ENTIRELY by JS state (see useDirection) —
 * never by the native RTL machinery. v11 tried to heal the desync with
 * I18nManager.forceRTL() + a one-time remount; on Android (RN 0.88, New
 * Architecture) the native layout direction is seeded when the Fabric
 * surface starts, a JS remount cannot flip an already-started surface,
 * and the persisted native RTL flag re-seeds at every launch, so the
 * heal never converged and a flipped install stayed flipped forever.
 *
 * So: pin the native direction to LTR permanently, before any UI
 * renders. Yoga then never auto-flips anything, logical style props
 * (marginStart, textAlign:'left', …) resolve physically and
 * deterministically on every device, and the visible mirror for Urdu
 * comes only from useDirection() below — a pure function of the
 * language state that applies instantly, in-session, with zero
 * dependence on I18nManager behaving.
 */
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

const STRINGS: Record<Language, Strings> = { en, ur };

export function getStrings(lang: Language): Strings {
  return STRINGS[lang];
}

/** Simple `t` accessor: returns the full Strings object for a language. */
export function t(lang: Language): Strings {
  return getStrings(lang);
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // getSetting never throws; null = nothing readable in either layer.
      const saved = await getSetting(LANGUAGE_STORAGE_KEY);
      if (cancelled) {
        return;
      }
      // Always resolve — including the default-English fallback. The
      // rendered direction derives from this state alone (useDirection),
      // so a stored 'en' on a previously flipped install renders proper
      // LTR on the very first launch: no native flag can override it.
      setLanguageState(saved === 'ur' ? 'ur' : 'en');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    // Applies instantly in-session: pure React state → re-render with
    // the new strings and the new useDirection() values. No restart,
    // no remount, no native call.
    setLanguageState(lang);
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

  return createElement(LanguageContext.Provider, { value }, children);
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

/**
 * JS-owned layout direction, derived purely from the language state.
 *
 * The native direction is pinned to LTR (module scope above), so every
 * component that lays out a row, aligns text, or spaces siblings off the
 * "start" side MUST take its direction from here:
 *
 * - `rowDirection` — apply to every horizontal container (StyleSheet
 *   `flexDirection: 'row'` alone no longer mirrors anything).
 * - `textStart` / `textEnd` — `textAlign` for block text: start-aligned
 *   in the active language. Leave 'center' alone; license-key and
 *   phone/number inputs stay 'left' (Latin codes).
 * - `flip` — mirror transform for DIRECTIONAL icons (chevrons, back /
 *   forward arrows) in RTL. Symmetric icons (key, phone, copy, plus)
 *   must NOT be flipped.
 * - `marginStart` / `marginEnd` / `paddingStart` — physical styles for
 *   logical start/end spacing. Logical style props are NOT used for
 *   this: with the native pin they resolve to fixed physical sides and
 *   would sit on the wrong side in a mirrored row.
 */
export interface Direction {
  rtl: boolean;
  rowDirection: 'row' | 'row-reverse';
  textStart: 'left' | 'right';
  textEnd: 'left' | 'right';
  flip: { transform: [{ scaleX: -1 }] } | undefined;
  marginStart: (value: number) => ViewStyle;
  marginEnd: (value: number) => ViewStyle;
  paddingStart: (value: number) => ViewStyle;
}

export function useDirection(): Direction {
  const { rtl } = useLanguage();
  return useMemo<Direction>(
    () => ({
      rtl,
      rowDirection: rtl ? 'row-reverse' : 'row',
      textStart: rtl ? 'right' : 'left',
      textEnd: rtl ? 'left' : 'right',
      flip: rtl ? { transform: [{ scaleX: -1 }] } : undefined,
      marginStart: (value: number) =>
        rtl ? { marginRight: value } : { marginLeft: value },
      marginEnd: (value: number) =>
        rtl ? { marginLeft: value } : { marginRight: value },
      paddingStart: (value: number) =>
        rtl ? { paddingRight: value } : { paddingLeft: value },
    }),
    [rtl],
  );
}
