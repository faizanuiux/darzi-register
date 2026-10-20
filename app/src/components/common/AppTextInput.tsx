import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../core/theme/ThemeProvider';

interface AppTextInputProps extends TextInputProps {
  label?: string;
  /** Validation error text shown under the input. */
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export function AppTextInput({
  label,
  error,
  containerStyle,
  style,
  ...rest
}: AppTextInputProps) {
  const { theme } = useTheme();
  const { colors, spacing, radius, fontSize, fontFamily } = theme;

  return (
    <View style={containerStyle}>
      {label ? (
        <Text
          style={[
            styles.label,
            {
              color: colors.ink,
              fontSize: fontSize.sm,
              fontFamily: fontFamily.semiBold,
              marginBottom: spacing.xs,
            },
          ]}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          {
            backgroundColor: colors.card,
            borderColor: error ? colors.danger : colors.line,
            color: colors.ink,
            fontSize: fontSize.md,
            fontFamily: fontFamily.regular,
            borderRadius: radius.lg,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text
          style={[
            styles.error,
            {
              color: colors.danger,
              fontSize: fontSize.xs,
              fontFamily: fontFamily.medium,
              marginTop: spacing.xs,
            },
          ]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {},
  input: {
    borderWidth: 1,
    minHeight: 50,
  },
  error: {},
});
