import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../core/theme/ThemeProvider';

export type AppButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'brass';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: AppButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  /** Lucide icon rendered before the label. */
  icon?: LucideIcon;
  style?: StyleProp<ViewStyle>;
}

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon: Icon,
  style,
}: AppButtonProps) {
  const { theme } = useTheme();
  const { colors, spacing, radius, fontSize, fontFamily } = theme;

  const backgroundColor =
    variant === 'primary'
      ? colors.primary
      : variant === 'brass'
        ? colors.accent
        : variant === 'danger'
          ? colors.danger
          : variant === 'secondary'
            ? colors.primarySoft
            : 'transparent';

  const textColor =
    variant === 'primary'
      ? colors.white
      : variant === 'brass'
        ? colors.primaryDark
        : variant === 'danger'
          ? colors.white
          : variant === 'secondary'
            ? colors.primaryText
            : colors.ink;

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.button,
        {
          backgroundColor,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.lg,
          opacity: isDisabled ? 0.55 : 1,
        },
        variant === 'ghost' && { borderWidth: 1, borderColor: colors.line },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <View style={styles.labelRow}>
          {Icon ? <Icon size={18} color={textColor} /> : null}
          <Text
            style={[
              styles.label,
              {
                color: textColor,
                fontSize: fontSize.md,
                fontFamily: fontFamily.semiBold,
              },
            ]}>
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    textAlign: 'center',
  },
});
