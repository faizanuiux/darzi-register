// Centralized design tokens. All components must use these — no hardcoded colors/spacing.
//
// BRAND: forest #163D32 (primary), ivory #FAF7F0 (backgrounds), brass #C9A227
// (accents/CTAs), ink #1B2420 (text), muted #6B7570. Matches the marketing site.

export const colors: Record<string, string> = {
  primary: '#163D32',
  primaryDark: '#0F2C24',
  primarySoft: '#E9F0EB',
  // Foreground role of the brand green: text/icons that SIT ON background,
  // card or primarySoft surfaces. Identical to `primary` in light mode;
  // lightened in dark mode where #163D32 on near-black is invisible.
  // Never use as a background — use `primary` for surfaces.
  primaryText: '#163D32',
  accent: '#C9A227',
  accentSoft: '#F7EFDA',
  accentDark: '#A8861D',
  background: '#FAF7F0',
  card: '#ffffff',
  ink: '#1B2420',
  muted: '#6B7570',
  line: '#E4DDCF',
  danger: '#C0392B',
  dangerSoft: '#FBEDEB',
  success: '#1E7F4F',
  successSoft: '#E6F4EC',
  // Foreground roles for status colors (same light/dark split as
  // primaryText: unchanged in light, lightened in dark).
  successText: '#1E7F4F',
  warning: '#B7791F',
  warningSoft: '#FBF3E2',
  warningText: '#B7791F',
  // Tab bar surface. Ivory card in light; a deep green-black in dark so
  // the bar does not glow against the dark background.
  tabBar: '#ffffff',
  white: '#ffffff',
  black: '#000000',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
} as const;

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

/**
 * Outfit font families. Always pair a weight token with its matching family
 * (Android does not synthesize custom-font weights reliably), e.g.
 * semibold text → fontFamily.semiBold and NO numeric fontWeight.
 */
export const fontFamily = {
  regular: 'Outfit-Regular',
  medium: 'Outfit-Medium',
  semiBold: 'Outfit-SemiBold',
  bold: 'Outfit-Bold',
} as const;

export type Theme = {
  colors: typeof colors;
  spacing: typeof spacing;
  radius: typeof radius;
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
  fontFamily: typeof fontFamily;
  dark: boolean;
};

export const lightTheme: Theme = {
  colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
  dark: false,
};

export const darkTheme: Theme = {
  ...lightTheme,
  colors: {
    ...colors,
    background: '#121815',
    card: '#1C2420',
    ink: '#F1F4EF',
    muted: '#9AA49E',
    line: '#2C362F',
    primarySoft: '#1D332A',
    accentSoft: '#2E2A1A',
    // Foreground greens/status colors lightened for dark surfaces:
    // #163D32 text on #121815 measured ~1.3:1 (invisible); #9CCBAF is ~9:1.
    primaryText: '#9CCBAF',
    successText: '#7FCB9B',
    warningText: '#E3B95B',
    // Soft tints as dark translucent-style chips instead of pale glows.
    dangerSoft: '#3B2422',
    successSoft: '#1E3329',
    warningSoft: '#33291A',
    // Slightly lifted so error icons/text stay readable on dark cards.
    danger: '#D66A5B',
    // Deep green-black bar; focused-tab brass indicator + lightened
    // primaryText keep the active tab legible.
    tabBar: '#0E1F19',
  },
  dark: true,
};
