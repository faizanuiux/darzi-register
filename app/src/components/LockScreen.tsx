import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Clipboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Check, Copy, MessageCircle } from 'lucide-react-native';
import { getDeviceId } from '../services/device/deviceService';
import { formatLicenseKeyInput } from '../features/activation/licenseKeyFormat';
import { sanitizeErrorDetail } from '../core/api/supabase';
import { useStrings } from '../core/i18n/i18n';
import { useTheme } from '../core/theme/ThemeProvider';
import type { Theme } from '../core/theme/tokens';
import {
  activate,
  LicenseError,
} from '../services/licensing/licenseService';

// Colors for content sitting ON the always-forest header (both themes).
const ON_FOREST = '#FAF7F0';
const ON_FOREST_MUTED = '#D8E2DC';
// WhatsApp brand green (button is green in both themes by design).
const WHATSAPP_GREEN = '#25D366';
/** Support number (Boss) — wa.me form: country code + number, no '+'. */
const SUPPORT_WHATSAPP_URL = 'https://wa.me/923451081073';

export interface LockScreenProps {
  reason: 'expired' | 'disabled';
  onReactivated: () => void;
}

const COPY: Record<
  LockScreenProps['reason'],
  { title: string; message: string }
> = {
  expired: {
    title: 'License Expired',
    message: 'Your license has expired. Please renew your key.',
  },
  disabled: {
    title: 'License Disabled',
    message: 'This license has been disabled. Please contact support.',
  },
};

/** Map LicenseError codes to user-facing messages. The key is never shown.
 * Non-license failures (local device problems, e.g. the activation could
 * not be saved) are NOT network errors — they get the 'storage' message.
 */
function errorMessageFor(err: unknown): string {
  if (!(err instanceof LicenseError)) {
    return "Couldn't save the activation on this device. Please try again.";
  }
  switch (err.code) {
    case 'invalid':
      return 'This key is not valid. Please check it and try again.';
    case 'used':
      return 'This key is already used on another device.';
    case 'expired':
      return 'This key has expired. Please renew your key.';
    case 'disabled':
      return 'This license has been disabled. Please contact support.';
    case 'network':
      return 'No internet connection. Please try again.';
    case 'conflict':
      return 'This device already has a license key. If this keeps happening, contact support.';
    case 'format':
      return 'Key must look like DRZ-XXXX-XXXX.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

/**
 * Full-screen lock gate shown when the stored license is expired or
 * disabled. Lets the user enter a fresh key and reactivate without leaving
 * the app.
 */
export function LockScreen({ reason, onReactivated }: LockScreenProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const s = useStrings();
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copy = COPY[reason];

  // Surface the device ID on the lock screen: when a customer messages
  // support to renew, they read/copy it straight from here. Failure to
  // read it hides the row silently — it must never block the screen.
  useEffect(() => {
    let cancelled = false;
    getDeviceId()
      .then((id) => {
        if (!cancelled && id) {
          setDeviceId(id);
        }
      })
      .catch(() => {
        // Silently hidden.
      });
    return () => {
      cancelled = true;
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }
    };
  }, []);

  const handleCopyDeviceId = () => {
    if (!deviceId) {
      return;
    }
    Clipboard.setString(deviceId);
    setCopied(true);
    if (copyTimer.current) {
      clearTimeout(copyTimer.current);
    }
    copyTimer.current = setTimeout(() => setCopied(false), 1600);
  };

  const handleWhatsApp = () => {
    // Prefilled renewal request to support, carrying the reason and —
    // when readable — the device ID, so the customer sends everything
    // needed in one tap. wa.me opens WhatsApp or falls back to the
    // browser; a failure here must never crash the lock screen.
    const reasonWord = reason === 'disabled' ? 'disabled' : 'expired';
    const idSentence = deviceId
      ? ` My Device ID is: ${deviceId}.`
      : '';
    const message =
      `Assalam o Alaikum, my Darzi Register license is ${reasonWord}.` +
      `${idSentence} Please renew my activation.`;
    const url = `${SUPPORT_WHATSAPP_URL}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      // No handler for the link — nothing else we can do from here.
    });
  };

  const handleActivate = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    setErrorDetail(null);
    try {
      // Same Android ID source the rest of the app uses; reuse the ID
      // already shown on screen when it was read successfully.
      const id = deviceId ?? (await getDeviceId());
      await activate(formatLicenseKeyInput(key), id);
      onReactivated();
    } catch (err) {
      // LicenseError carries no key material in its message — safe to show.
      setError(errorMessageFor(err));
      // Network failures carry the real underlying reason; local (storage)
      // failures carry the thrown error's name + message, sanitized. Either
      // way the detail line shows the REAL reason for on-device diagnosis.
      setErrorDetail(
        err instanceof LicenseError
          ? err.code === 'network'
            ? (err.detail ?? null)
            : null
          : err instanceof Error
            ? sanitizeErrorDetail(`${err.name}: ${err.message}`)
            : null,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <View style={styles.badge}>
          <View style={styles.shackle} />
          <View style={styles.lockBody}>
            <View style={styles.keyhole} />
          </View>
        </View>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.message}>{copy.message}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.label}>Enter a new license key</Text>
          <TextInput
            style={styles.input}
            value={key}
            onChangeText={(text) => {
              // RAW text while typing — transforming here (uppercase,
              // dashes) fights the keyboard's IME composition and drops
              // keystrokes on Samsung Keyboard. Formatting happens on
              // blur and on submit via formatLicenseKeyInput.
              setKey(text);
              if (error) {
                setError(null);
                setErrorDetail(null);
              }
            }}
            onBlur={() => setKey((k) => formatLicenseKeyInput(k))}
            placeholder="DRZ-XXXX-XXXX"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            maxLength={20}
            editable={!busy}
            returnKeyType="done"
            onSubmitEditing={() => void handleActivate()}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {errorDetail ? (
            <Text style={styles.errorDetail}>{`Details: ${errorDetail}`}</Text>
          ) : null}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              busy && styles.buttonBusy,
            ]}
            onPress={() => void handleActivate()}
            disabled={busy}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator color={colors.primaryDark} />
            ) : (
              <Text style={styles.buttonText}>Activate</Text>
            )}
          </Pressable>
        </View>

        {deviceId ? (
          <View style={styles.deviceCard}>
            <Text style={styles.label}>{s.activation.yourDeviceId}</Text>
            <View style={styles.deviceRow}>
              <Text
                style={styles.deviceIdText}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {deviceId}
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.copyButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleCopyDeviceId}
                accessibilityRole="button"
                accessibilityLabel={s.activation.copy}
              >
                {copied ? (
                  <Check size={14} color={colors.white} />
                ) : (
                  <Copy size={14} color={colors.white} />
                )}
                <Text style={styles.copyText}>
                  {copied ? s.activation.copied : s.activation.copy}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.whatsappButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleWhatsApp}
          accessibilityRole="button"
          accessibilityLabel={s.activation.contactWhatsApp}
        >
          <MessageCircle size={20} color={colors.white} />
          <Text style={styles.whatsappText}>{s.activation.contactWhatsApp}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(theme: Theme) {
  const { colors } = theme;
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      backgroundColor: colors.primary,
      paddingTop: 72,
      paddingBottom: 40,
      paddingHorizontal: 32,
      alignItems: 'center',
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
    },
    badge: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    shackle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 7,
      borderColor: colors.primary,
      borderBottomWidth: 0,
      marginBottom: -12,
    },
    lockBody: {
      width: 52,
      height: 40,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    keyhole: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.accent,
    },
    title: {
      fontFamily: 'Outfit',
      fontWeight: '700',
      fontSize: 26,
      color: ON_FOREST,
      marginBottom: 10,
      textAlign: 'center',
    },
    message: {
      fontFamily: 'Outfit',
      fontSize: 15,
      color: ON_FOREST_MUTED,
      textAlign: 'center',
      lineHeight: 22,
    },
    body: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 32,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.line,
    },
    deviceCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.line,
      marginTop: 16,
    },
    deviceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    deviceIdText: {
      flex: 1,
      fontFamily: 'monospace',
      fontSize: 14,
      color: colors.primaryText,
      marginEnd: 10,
    },
    copyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    copyText: {
      fontFamily: 'Outfit',
      fontWeight: '600',
      fontSize: 13,
      color: colors.white,
      marginStart: 5,
    },
    whatsappButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: WHATSAPP_GREEN,
      borderRadius: 14,
      paddingVertical: 15,
      marginTop: 16,
    },
    whatsappText: {
      fontFamily: 'Outfit',
      fontWeight: '700',
      fontSize: 16,
      color: colors.white,
      marginStart: 8,
    },
    label: {
      fontFamily: 'Outfit',
      fontWeight: '600',
      fontSize: 15,
      color: colors.ink,
      marginBottom: 12,
    },
    input: {
      fontFamily: 'Outfit',
      fontSize: 18,
      letterSpacing: 2,
      color: colors.ink,
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: colors.accent,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 8,
    },
    error: {
      fontFamily: 'Outfit',
      fontSize: 13,
      color: colors.danger,
      marginTop: 8,
      marginBottom: 4,
      lineHeight: 18,
    },
    errorDetail: {
      fontFamily: 'Outfit',
      fontSize: 11,
      color: colors.muted,
      marginTop: 2,
      marginBottom: 4,
      lineHeight: 15,
    },
    button: {
      backgroundColor: colors.accent,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
      marginTop: 12,
    },
    buttonPressed: {
      opacity: 0.85,
    },
    buttonBusy: {
      opacity: 0.7,
    },
    buttonText: {
      fontFamily: 'Outfit',
      fontWeight: '700',
      fontSize: 16,
      color: colors.primaryDark,
    },
  });
}
