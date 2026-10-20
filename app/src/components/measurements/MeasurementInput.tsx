import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useDirection } from '../../core/i18n/i18n';
import { useTheme } from '../../core/theme/ThemeProvider';

interface MeasurementInputProps {
  labelEn: string;
  labelUr: string;
  value: string;
  onChangeText: (text: string) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Single measurement row: bilingual label on one side, free-text input on
 * the other. Fractions/units are preserved as typed (default keyboard).
 */
export function MeasurementInput({
  labelEn,
  labelUr,
  value,
  onChangeText,
  style,
}: MeasurementInputProps) {
  const { theme } = useTheme();
  const dir = useDirection();
  const { colors, spacing, radius, fontSize, fontFamily } = theme;

  return (
    <View style={[styles.row, { flexDirection: dir.rowDirection, marginBottom: spacing.sm }, style]}>
      <View style={[styles.labels, dir.marginEnd(spacing.md)]}>
        <Text
          numberOfLines={1}
          style={{ color: colors.ink, fontSize: fontSize.sm, fontFamily: fontFamily.semiBold, textAlign: dir.textStart }}>
          {labelEn}
        </Text>
        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: fontSize.xs, fontFamily: fontFamily.regular, textAlign: dir.textStart }}>
          {labelUr}
        </Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="–"
        placeholderTextColor={colors.muted}
        autoCorrect={false}
        accessibilityLabel={`${labelEn} / ${labelUr}`}
        style={[
          styles.input,
          {
            backgroundColor: colors.background,
            borderColor: colors.line,
            color: colors.ink,
            fontSize: fontSize.md,
            fontFamily: fontFamily.medium,
            borderRadius: radius.md,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.sm,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labels: {
    flex: 1,
  },
  input: {
    width: 120,
    borderWidth: 1,
    textAlign: 'center',
  },
});
