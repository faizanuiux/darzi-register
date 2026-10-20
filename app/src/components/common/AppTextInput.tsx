import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useDirection } from '../../core/i18n/i18n';
import { useTheme } from '../../core/theme/ThemeProvider';

/** Keyboard types whose content is a Latin code/number — always LTR-left. */
const LTR_KEYBOARD_TYPES = ['phone-pad', 'number-pad', 'numeric', 'decimal-pad'];

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
  const dir = useDirection();
  const { colors, spacing, radius, fontSize, fontFamily } = theme;

  // Free text follows the language (Urdu → right-aligned); phone/number
  // fields hold Latin digits and always stay left-aligned.
  const inputAlign = LTR_KEYBOARD_TYPES.includes(rest.keyboardType ?? '')
    ? 'left'
    : dir.textStart;

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
              textAlign: dir.textStart,
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
            textAlign: inputAlign,
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
              textAlign: dir.textStart,
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
