// Settings screen.
//
// Sections: License, Language, Appearance, Import/Export, About, Privacy, App version.
//
// The license card is fed by the licensing team through
// getLicenseCardInfo() (src/services/licensing/licenseService). The export
// may not exist yet, so it is resolved defensively at runtime: null means
// "No license". The license KEY IS NEVER SHOWN IN FULL: only the masked
// key hint from the service is rendered. No secrets are displayed.

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Calendar,
  ChevronRight,
  DatabaseBackup,
  KeyRound,
  Languages,
  Moon,
  ShieldCheck,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { AppHeader } from '../../../components/common';
import { useLanguage } from '../../../core/i18n/i18n';
import { useTheme } from '../../../core/theme/ThemeProvider';
import { ENV } from '../../../core/config/env';

export type AppLanguage = 'en' | 'ur';

export interface LicenseInfo {
  status: 'active' | 'inactive';
  /** Full key — this screen only ever renders the masked form. */
  key: string;
  deviceId: string;
  /** ISO date or display string of activation. */
  activatedOn: string;
}

/**
 * Card data supplied by the licensing team. daysRemaining null = lifetime.
 */
interface LicenseCardInfo {
  status: 'active' | 'expired' | 'disabled';
  /** Masked key hint, e.g. "DRZ-****-3F9A". Never the full key. */
  keyHint: string;
  /** Whole days left; null means a lifetime license. */
  daysRemaining: number | null;
  /** ISO date string of activation, or ''. */
  activatedAt: string;
}

async function fetchLicenseCard(): Promise<LicenseCardInfo | null> {
  try {
    const mod = (await import(
      '../../../services/licensing/licenseService'
    )) as unknown as {
      getLicenseCardInfo?: () => Promise<LicenseCardInfo | null>;
    };
    if (typeof mod.getLicenseCardInfo === 'function') {
      return mod.getLicenseCardInfo();
    }
  } catch {
    // Licensing export not wired yet — fall through to "no license".
  }
  return null;
}

/** Mask a key like DRZ-AB12-CD34 to DRZ-****-CD34. Never render the raw key. */
export function maskLicenseKey(key: string): string {
  if (!key) {
    return '';
  }
  const parts = key.split('-');
  if (parts.length < 2) {
    return '****';
  }
  return `${parts[0]}-****-${parts[parts.length - 1]}`;
}

function formatDate(iso: string): string {
  if (!iso) {
    return '–';
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const { colors, spacing, radius, fontSize, fontFamily } = theme;
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <View style={[styles.sectionHeader, { marginBottom: spacing.sm }]}>
        {Icon ? (
          <View style={[styles.sectionIcon, { backgroundColor: colors.primarySoft, marginEnd: spacing.sm }]}>
            <Icon size={15} color={colors.primaryText} />
          </View>
        ) : null}
        <Text
          style={{
            fontSize: fontSize.sm,
            fontFamily: fontFamily.semiBold,
            color: colors.muted,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}>
          {title}
        </Text>
      </View>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderRadius: radius.lg,
            padding: spacing.md,
          },
        ]}>
        {children}
      </View>
    </View>
  );
}

function StatusPill({ status }: { status: LicenseCardInfo['status'] }) {
  const { theme } = useTheme();
  const { strings } = useLanguage();
  const { colors, spacing, radius, fontSize, fontFamily } = theme;
  const t = strings.settings;

  const config = {
    active: { bg: colors.successSoft, fg: colors.successText, label: t.licenseActive },
    expired: { bg: colors.warningSoft, fg: colors.warningText, label: t.licenseExpired },
    disabled: { bg: colors.dangerSoft, fg: colors.danger, label: t.licenseDisabled },
  }[status];

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: config.bg,
          borderRadius: radius.pill,
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.md,
        },
      ]}>
      <View style={[styles.pillDot, { backgroundColor: config.fg }]} />
      <Text style={{ color: config.fg, fontSize: fontSize.xs, fontFamily: fontFamily.semiBold }}>
        {config.label}
      </Text>
    </View>
  );
}

function LicenseCard() {
  const { theme } = useTheme();
  const { strings } = useLanguage();
  const { colors, spacing, radius, fontSize, fontFamily } = theme;
  const t = strings.settings;

  const [info, setInfo] = useState<LicenseCardInfo | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const card = await fetchLicenseCard();
      if (!cancelled) {
        setInfo(card);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const daysText =
    info && info.daysRemaining !== null
      ? `${info.daysRemaining} ${t.daysRemaining}`
      : t.lifetime;

  return (
    <View
      style={[
        styles.licenseCard,
        {
          backgroundColor: colors.primary,
          borderRadius: radius.xl,
          padding: spacing.lg,
          marginBottom: spacing.lg,
        },
      ]}>
      <View style={[styles.licenseTop, { marginBottom: spacing.md }]}>
        <View style={[styles.licenseIcon, { backgroundColor: 'rgba(201,162,39,0.2)' }]}>
          <KeyRound size={22} color={colors.accent} />
        </View>
        <View style={styles.licenseTitleWrap}>
          <Text
            style={{
              color: colors.white,
              fontSize: fontSize.md,
              fontFamily: fontFamily.semiBold,
            }}>
            {t.license}
          </Text>
          <Text
            style={{
              color: 'rgba(255,255,255,0.65)',
              fontSize: fontSize.sm,
              fontFamily: fontFamily.regular,
            }}>
            {info ? info.keyHint || '–' : t.noLicense}
          </Text>
        </View>
        {info ? (
          <StatusPill status={info.status} />
        ) : info === null ? (
          <View
            style={[
              styles.pill,
              {
                backgroundColor: 'rgba(255,255,255,0.15)',
                borderRadius: radius.pill,
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.md,
              },
            ]}>
            <Text style={{ color: colors.white, fontSize: fontSize.xs, fontFamily: fontFamily.semiBold }}>
              {t.noLicense}
            </Text>
          </View>
        ) : (
          <ActivityIndicator size="small" color={colors.white} />
        )}
      </View>
      {info ? (
        <>
          <View style={[styles.licenseMeta, { gap: spacing.md }]}>
            <View style={styles.metaItem}>
              <ShieldCheck size={14} color={colors.accent} />
              <Text
                style={{
                  color: colors.white,
                  fontSize: fontSize.sm,
                  fontFamily: fontFamily.medium,
                  marginStart: spacing.xs,
                }}>
                {daysText}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Calendar size={14} color={colors.accent} />
              <Text
                style={{
                  color: 'rgba(255,255,255,0.75)',
                  fontSize: fontSize.sm,
                  fontFamily: fontFamily.regular,
                  marginStart: spacing.xs,
                }}>
                {t.activatedOn}: {formatDate(info.activatedAt)}
              </Text>
            </View>
          </View>
        </>
      ) : info === null ? (
        <Text
          style={{
            color: 'rgba(255,255,255,0.65)',
            fontSize: fontSize.sm,
            fontFamily: fontFamily.regular,
          }}>
          {t.noLicenseHint}
        </Text>
      ) : null}
    </View>
  );
}

export interface SettingsScreenProps {
  onOpenImportExport: () => void;
}

export function SettingsScreen({ onOpenImportExport }: SettingsScreenProps) {
  const { theme, dark, setDark } = useTheme();
  const { strings, language, setLanguage } = useLanguage();
  const { colors, spacing, radius, fontSize, fontFamily } = theme;
  const t = strings.settings;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AppHeader variant="brand" title={t.title} showBack={false} />
      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.lg, paddingBottom: spacing.xxl }]}>
        <LicenseCard />

        <Section title={t.appearance} icon={Moon}>
          <View style={[styles.toggleRow, { paddingVertical: spacing.sm }]}>
            <Text style={{ fontSize: fontSize.md, color: colors.ink, fontFamily: fontFamily.medium, flex: 1 }}>
              {t.darkMode}
            </Text>
            <Switch
              value={dark}
              onValueChange={setDark}
              trackColor={{ false: colors.line, true: colors.primary }}
              thumbColor={dark ? colors.accent : colors.card}
              accessibilityLabel={t.darkMode}
            />
          </View>
        </Section>

        <Section title={t.language} icon={Languages}>
          <View style={[styles.langRow, { gap: spacing.sm }]}>
            <TouchableOpacity
              style={[
                styles.langButton,
                {
                  borderColor: language === 'en' ? colors.primary : colors.line,
                  backgroundColor: language === 'en' ? colors.primary : colors.card,
                  borderRadius: radius.md,
                  paddingVertical: spacing.md,
                },
              ]}
              onPress={() => void setLanguage('en')}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.langText,
                  {
                    fontSize: fontSize.md,
                    fontFamily: fontFamily.semiBold,
                    color: language === 'en' ? colors.white : colors.muted,
                  },
                ]}>
                {t.english}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.langButton,
                {
                  borderColor: language === 'ur' ? colors.primary : colors.line,
                  backgroundColor: language === 'ur' ? colors.primary : colors.card,
                  borderRadius: radius.md,
                  paddingVertical: spacing.md,
                },
              ]}
              onPress={() => void setLanguage('ur')}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.langText,
                  {
                    fontSize: fontSize.md,
                    fontFamily: fontFamily.semiBold,
                    color: language === 'ur' ? colors.white : colors.muted,
                  },
                ]}>
                {t.urdu}
              </Text>
            </TouchableOpacity>
          </View>
        </Section>

        <Section title={t.importExport} icon={DatabaseBackup}>
          <TouchableOpacity style={[styles.navRow, { paddingVertical: spacing.md }]} onPress={onOpenImportExport} activeOpacity={0.7}>
            <View style={styles.navTextWrap}>
              <Text style={{ fontSize: fontSize.md, color: colors.ink, fontFamily: fontFamily.medium }}>
                {t.importExport}
              </Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.muted, fontFamily: fontFamily.regular, marginTop: 2 }}>
                {t.backup}
              </Text>
            </View>
            <ChevronRight size={20} color={colors.muted} />
          </TouchableOpacity>
        </Section>

        <Section title={t.about}>
          <Text style={[styles.body, { fontSize: fontSize.md, color: colors.ink, fontFamily: fontFamily.regular }]}>
            {t.aboutText}
          </Text>
        </Section>

        <Section title={t.privacy}>
          <Text style={[styles.body, { fontSize: fontSize.md, color: colors.ink, fontFamily: fontFamily.regular }]}>
            {t.privacyText}
          </Text>
        </Section>

        <Section title={t.version}>
          <Text style={[styles.body, { fontSize: fontSize.md, color: colors.ink, fontFamily: fontFamily.medium }]}>
            {ENV.appVersion}
          </Text>
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {},
  licenseCard: {
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  licenseTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  licenseIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  licenseTitleWrap: {
    flex: 1,
    marginHorizontal: 12,
  },
  licenseMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  langRow: { flexDirection: 'row' },
  langButton: {
    flex: 1,
    borderWidth: 1,
    alignItems: 'center',
  },
  langText: {},
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navTextWrap: {
    flex: 1,
  },
  body: { lineHeight: 22 },
});
