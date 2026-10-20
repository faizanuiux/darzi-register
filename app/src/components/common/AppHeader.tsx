import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../core/theme/ThemeProvider';

export interface HeaderAction {
  /** Stable key + accessibility fallback for the action button. */
  label: string;
  /** Lucide icon rendered for the action (preferred over text glyphs). */
  icon?: LucideIcon;
  onPress: () => void;
  accessibilityLabel?: string;
}

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  /**
   * 'brand' renders a forest header with white text and rounded bottom
   * corners; 'default' is the plain card-style header.
   */
  variant?: 'default' | 'brand';
  /**
   * Custom back handler. When omitted, the header shows a back chevron
   * whenever the navigator can go back, and calls navigation.goBack().
   */
  onBack?: () => void;
  /** Set to false to hide the automatic back chevron. */
  showBack?: boolean;
  actions?: HeaderAction[];
  style?: StyleProp<ViewStyle>;
}

export function AppHeader({
  title,
  subtitle,
  variant = 'default',
  onBack,
  showBack = true,
  actions = [],
  style,
}: AppHeaderProps) {
  const { theme } = useTheme();
  const { colors, spacing, fontSize, fontFamily, radius } = theme;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const canGoBack = navigation.canGoBack?.() ?? false;
  const handleBack = onBack ?? (() => navigation.goBack());
  const showBackButton = showBack && (onBack !== undefined || canGoBack);

  const brand = variant === 'brand';
  const fg = brand ? colors.white : colors.ink;
  const fgSoft = brand ? 'rgba(255,255,255,0.75)' : colors.muted;
  const accent = brand ? colors.white : colors.primary;

  return (
    <View
      style={[
        styles.container,
        brand
          ? {
              backgroundColor: colors.primary,
              borderBottomLeftRadius: radius.xl,
              borderBottomRightRadius: radius.xl,
              paddingTop: insets.top + spacing.md,
              paddingBottom: spacing.lg,
              paddingHorizontal: spacing.lg,
            }
          : {
              backgroundColor: colors.card,
              borderBottomColor: colors.line,
              borderBottomWidth: 1,
              paddingTop: insets.top + spacing.sm,
              paddingBottom: spacing.sm,
              paddingHorizontal: spacing.lg,
            },
        style,
      ]}>
      <View style={styles.row}>
        <View style={styles.side}>
          {showBackButton ? (
            <TouchableOpacity
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={12}
              style={styles.backButton}>
              <ChevronLeft size={26} color={accent} />
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.center}>
          <Text
            numberOfLines={1}
            style={[
              styles.title,
              {
                color: fg,
                fontSize: brand ? fontSize.xl : fontSize.lg,
                fontFamily: fontFamily.bold,
              },
            ]}>
            {title}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={{ color: fgSoft, fontSize: fontSize.sm, fontFamily: fontFamily.regular }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={[styles.side, styles.actions]}>
          {actions.map(action => (
            <TouchableOpacity
              key={action.accessibilityLabel ?? action.label}
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={action.accessibilityLabel ?? action.label}
              hitSlop={12}
              style={styles.actionButton}>
              {action.icon ? (
                <action.icon size={22} color={accent} />
              ) : (
                <Text style={{ color: accent, fontSize: fontSize.lg, fontFamily: fontFamily.semiBold }}>
                  {action.label}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  side: {
    width: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  actions: {
    justifyContent: 'flex-end',
  },
  backButton: {
    padding: 4,
  },
  actionButton: {
    padding: 4,
    marginLeft: 8,
  },
  title: {
    textAlign: 'center',
  },
});
