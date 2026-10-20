/**
 * ActivationScreen — first-run license gate.
 *
 * Brand-forward UI on a forest background:
 * - Brass scissors mark (lucide Scissors, no asset/emoji)
 * - Device ID row with a copy button (needed for support / key purchase)
 * - License key input: monospace; raw text while typing (IME-safe),
 *   normalized to DRZ-XXXX-XXXX on blur/submit
 * - Activate button with loading state, inline localized error messages,
 *   and a retry button on network errors
 * - App version footer
 *
 * The screen consumes the useActivation() result via the `activation` prop
 * and notifies the parent through `onActivated()` whenever the status
 * becomes 'active'.
 */

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Clipboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Copy, KeyRound, RefreshCw, Scissors } from 'lucide-react-native';
import { useDirection } from '../../../core/i18n/i18n';
import { useTheme } from '../../../core/theme/ThemeProvider';
import { ENV } from '../../../core/config/env';
import { formatLicenseKeyInput } from '../licenseKeyFormat';
import { en } from '../../../localization/en/common';
import type { Strings } from '../../../localization/en/common';
import type { UseActivation } from '../types';

export interface ActivationScreenProps {
  /** Called whenever activation becomes 'active' (fresh or restored). */
  onActivated: () => void;
  /** The result of useActivation(). */
  activation: UseActivation;
  /** Localized strings; defaults to English. Pass `ur` for Urdu. */
  strings?: Strings;
}

export function ActivationScreen({
  onActivated,
  activation,
  strings = en,
}: ActivationScreenProps): React.JSX.Element {
  const { theme } = useTheme();
  const dir = useDirection();
  const { colors, spacing, radius, fontSize, fontFamily } = theme;
  const insets = useSafeAreaInsets();
  const { status, deviceId, activate, error, errorDetail, isLoading } = activation;
  const [key, setKey] = useState('');
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevStatus = useRef(status);

  useEffect(() => {
    if (prevStatus.current !== 'active' && status === 'active') {
      onActivated();
    }
    prevStatus.current = status;
  }, [status, onActivated]);

  useEffect(() => {
    return () => {
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }
    };
  }, []);

  const t = strings.activation;

  const handleCopyDeviceId = (): void => {
    if (!deviceId) {
      return;
    }
    Clipboard.setString(deviceId);
    setCopied(true);
    if (copyTimer.current) {
      clearTimeout(copyTimer.current);
    }
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleActivate = (): void => {
    // `activate` never rejects — failures land in the `error` state.
    // Normalize the raw typed text to DRZ-XXXX-XXXX here (submit time),
    // never inside onChangeText — see licenseKeyFormat.ts.
    activate(formatLicenseKeyInput(key));
  };

  const errorMessage = error ? t.errors[error] : null;

  return (
    <View style={[styles.safe, { backgroundColor: colors.primary }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled">
        {/* Brand */}
        <View style={styles.brand}>
          <View
            style={[
              styles.brandBadge,
              { backgroundColor: colors.accent, marginBottom: spacing.lg },
            ]}>
            <Scissors size={44} color={colors.primaryDark} strokeWidth={2} />
          </View>
          <Text
            style={[
              styles.brandName,
              { color: colors.white, fontSize: fontSize.xxl, fontFamily: fontFamily.bold },
            ]}>
            {strings.appName}
          </Text>
          <Text
            style={[
              styles.brandBy,
              { color: 'rgba(255,255,255,0.7)', fontSize: fontSize.md, fontFamily: fontFamily.regular },
            ]}>
            {strings.byFaizan}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderRadius: radius.xl,
              padding: spacing.xl,
              marginHorizontal: spacing.xl,
            },
          ]}>
          <Text
            style={[
              styles.title,
              { color: colors.ink, fontSize: fontSize.xl, fontFamily: fontFamily.bold, marginBottom: spacing.xs, textAlign: dir.textStart },
            ]}>
            {t.title}
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: colors.muted, fontSize: fontSize.sm, fontFamily: fontFamily.regular, marginBottom: spacing.xl, textAlign: dir.textStart },
            ]}>
            {t.subtitle}
          </Text>

          {/* Device ID */}
          <Text
            style={[
              styles.label,
              { color: colors.ink, fontSize: fontSize.sm, fontFamily: fontFamily.semiBold, marginBottom: spacing.xs, textAlign: dir.textStart },
            ]}>
            {t.yourDeviceId}
          </Text>
          <View
            style={[
              styles.deviceRow,
              {
                flexDirection: dir.rowDirection,
                backgroundColor: colors.primarySoft,
                borderRadius: radius.lg,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
              },
            ]}>
            <Text
              style={[
                styles.deviceId,
                { color: colors.primaryText, fontSize: fontSize.sm, fontFamily: 'monospace', textAlign: dir.textStart },
                dir.marginEnd(spacing.sm),
              ]}
              numberOfLines={1}
              ellipsizeMode="middle">
              {deviceId ?? strings.common.loading}
            </Text>
            <TouchableOpacity
              style={[
                styles.copyButton,
                { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
              ]}
              onPress={handleCopyDeviceId}
              disabled={!deviceId}
              accessibilityLabel={t.copy}>
              <View style={[styles.copyRow, { flexDirection: dir.rowDirection }]}>
                {copied ? (
                  <Check size={14} color={colors.white} />
                ) : (
                  <Copy size={14} color={colors.white} />
                )}
                <Text
                  style={[
                    styles.copyText,
                    { color: colors.white, fontSize: fontSize.sm, fontFamily: fontFamily.semiBold },
                    dir.marginStart(spacing.xs),
                  ]}>
                  {copied ? t.copied : t.copy}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Key input */}
          <Text
            style={[
              styles.label,
              styles.keyLabel,
              { color: colors.ink, fontSize: fontSize.sm, fontFamily: fontFamily.semiBold, marginBottom: spacing.xs, marginTop: spacing.lg, textAlign: dir.textStart },
            ]}>
            {strings.settings.licenseKey}
          </Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: errorMessage ? colors.danger : colors.line,
                  borderRadius: radius.lg,
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.md,
                  // Key icon is pinned to the physical left and the key
                  // itself is a Latin code — this field never mirrors.
                  paddingLeft: 44,
                  textAlign: 'left',
                  fontSize: fontSize.lg,
                  fontFamily: 'monospace',
                  color: colors.ink,
                  backgroundColor: colors.background,
                },
              ]}
              value={key}
              onChangeText={setKey}
              onBlur={() => setKey((k) => formatLicenseKeyInput(k))}
              placeholder={t.keyPlaceholder}
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              maxLength={20}
              editable={!isLoading}
              returnKeyType="done"
              onSubmitEditing={handleActivate}
              testID="license-key-input"
            />
            <View style={[styles.inputIcon, { left: spacing.md }]}>
              <KeyRound size={20} color={colors.muted} />
            </View>
          </View>

          {errorMessage ? (
            <Text
              style={[
                styles.errorText,
                { color: colors.danger, fontSize: fontSize.sm, fontFamily: fontFamily.medium, marginTop: spacing.sm, textAlign: dir.textStart },
              ]}
              testID="activation-error">
              {errorMessage}
            </Text>
          ) : null}

          {(error === 'network' || error === 'storage') && errorDetail ? (
            <Text
              style={[
                styles.errorDetailText,
                { color: colors.muted, fontSize: fontSize.xs, fontFamily: fontFamily.regular, marginTop: spacing.xs, textAlign: dir.textStart },
              ]}
              testID="activation-error-detail">
              {`Details: ${errorDetail}`}
            </Text>
          ) : null}

          {error === 'network' ? (
            <TouchableOpacity
              style={[
                styles.retryButton,
                {
                  // Sits at the language start edge (right in Urdu).
                  alignSelf: dir.rtl ? 'flex-end' : 'flex-start',
                  borderColor: colors.primary,
                  borderRadius: radius.pill,
                  paddingVertical: spacing.xs,
                  paddingHorizontal: spacing.md,
                  marginTop: spacing.sm,
                },
              ]}
              onPress={handleActivate}
              disabled={isLoading}
              testID="retry-button">
              <View style={[styles.copyRow, { flexDirection: dir.rowDirection }]}>
                <RefreshCw size={14} color={colors.primaryText} />
                <Text
                  style={[
                    styles.retryText,
                    { color: colors.primaryText, fontSize: fontSize.sm, fontFamily: fontFamily.semiBold },
                    dir.marginStart(spacing.xs),
                  ]}>
                  {strings.common.retry}
                </Text>
              </View>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[
              styles.activateButton,
              {
                backgroundColor: colors.accent,
                borderRadius: radius.lg,
                paddingVertical: spacing.md,
                marginTop: spacing.lg,
                opacity: isLoading ? 0.7 : 1,
              },
            ]}
            onPress={handleActivate}
            disabled={isLoading}
            testID="activate-button">
            {isLoading ? (
              <ActivityIndicator color={colors.primaryDark} testID="loading-indicator" />
            ) : (
              <Text
                style={[
                  styles.activateText,
                  { color: colors.primaryDark, fontSize: fontSize.md, fontFamily: fontFamily.bold },
                ]}>
                {isLoading ? t.activating : t.activate}
              </Text>
            )}
          </TouchableOpacity>

          <Text
            style={[
              styles.hint,
              { color: colors.muted, fontSize: fontSize.xs, fontFamily: fontFamily.regular, marginTop: spacing.md },
            ]}>
            {t.needInternet}
          </Text>
        </View>

        <Text
          style={[
            styles.version,
            { color: 'rgba(255,255,255,0.6)', fontSize: fontSize.xs, fontFamily: fontFamily.regular, marginTop: spacing.xl },
          ]}>
          {strings.settings.version} {ENV.appVersion}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    padding: 0,
    justifyContent: 'center',
  },
  brand: {
    alignItems: 'center',
    marginBottom: 28,
    paddingHorizontal: 24,
  },
  brandBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  brandName: {
    textAlign: 'center',
  },
  brandBy: {
    textAlign: 'center',
    marginTop: 2,
  },
  card: {
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  title: {},
  subtitle: {},
  label: {},
  keyLabel: {},
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceId: {
    flex: 1,
  },
  copyButton: {},
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copyText: {},
  inputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    letterSpacing: 1,
  },
  inputIcon: {
    position: 'absolute',
  },
  errorText: {},
  errorDetailText: {},
  retryButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  retryText: {},
  activateButton: {
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  activateText: {},
  hint: {
    textAlign: 'center',
  },
  version: {
    textAlign: 'center',
  },
});
