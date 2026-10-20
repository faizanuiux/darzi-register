import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../core/theme/ThemeProvider';

interface LoadingIndicatorProps {
  label?: string;
  /** When true, fills the screen and centers itself. */
  fullScreen?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function LoadingIndicator({ label, fullScreen = false, style }: LoadingIndicatorProps) {
  const { theme } = useTheme();
  const { colors, spacing, fontSize, fontFamily } = theme;

  return (
    <View
      style={[
        styles.container,
        fullScreen && styles.fullScreen,
        { backgroundColor: fullScreen ? colors.background : 'transparent', padding: spacing.lg },
        style,
      ]}>
      <ActivityIndicator size="large" color={colors.primaryText} />
      {label ? (
        <Text
          style={[
            styles.label,
            {
              color: colors.muted,
              fontSize: fontSize.sm,
              fontFamily: fontFamily.regular,
              marginTop: spacing.sm,
            },
          ]}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreen: {
    flex: 1,
  },
  label: {
    textAlign: 'center',
  },
});
