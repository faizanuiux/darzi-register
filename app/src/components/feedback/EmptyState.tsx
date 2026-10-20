import type { LucideIcon } from 'lucide-react-native';
import { Users } from 'lucide-react-native';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../core/theme/ThemeProvider';
import { AppButton } from '../common/AppButton';

interface EmptyStateProps {
  /**
   * Lucide icon rendered in a soft circle above the title. A plain string
   * is also accepted for legacy callers (rendered as a text glyph).
   */
  icon?: LucideIcon | string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  icon = Users,
  title,
  message,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  const { theme } = useTheme();
  const { colors, spacing, fontSize, fontFamily } = theme;
  const legacyGlyph = typeof icon === 'string';

  return (
    <View
      style={[
        styles.container,
        { padding: spacing.xxl },
        style,
      ]}>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: colors.primarySoft, marginBottom: spacing.lg },
        ]}>
        {legacyGlyph ? (
          <Text style={{ fontSize: 42 }}>{icon}</Text>
        ) : (
          (() => { const Icon = icon as LucideIcon; return <Icon size={42} color={colors.primaryText} strokeWidth={1.75} />; })()
        )}
      </View>
      <Text
        style={[
          styles.title,
          {
            color: colors.ink,
            fontSize: fontSize.lg,
            fontFamily: fontFamily.semiBold,
            marginBottom: spacing.xs,
          },
        ]}>
        {title}
      </Text>
      {message ? (
        <Text
          style={[
            styles.message,
            {
              color: colors.muted,
              fontSize: fontSize.sm,
              fontFamily: fontFamily.regular,
              marginBottom: actionLabel ? spacing.lg : 0,
            },
          ]}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <AppButton title={actionLabel} onPress={onAction} variant="secondary" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
  },
});
