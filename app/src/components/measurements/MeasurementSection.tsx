import { Controller, type Control } from 'react-hook-form';
import { Ruler } from 'lucide-react-native';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { MEASUREMENT_FIELDS } from '../../core/constants/fields';
import { useStrings } from '../../core/i18n/i18n';
import { useTheme } from '../../core/theme/ThemeProvider';
import type { CustomerFormValues } from '../../features/customer-editor/validation/customerFormSchema';
import { MeasurementInput } from './MeasurementInput';

interface MeasurementSectionProps {
  control: Control<CustomerFormValues>;
  style?: StyleProp<ViewStyle>;
}

/** Renders all 9 measurement fields (order/labels from MEASUREMENT_FIELDS). */
export function MeasurementSection({ control, style }: MeasurementSectionProps) {
  const { theme } = useTheme();
  const s = useStrings();
  const { colors, spacing, radius, fontSize, fontFamily } = theme;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          padding: spacing.lg,
        },
        style,
      ]}>
      <View style={[styles.headingRow, { marginBottom: spacing.md }]}>
        <View style={[styles.iconBadge, { backgroundColor: colors.primarySoft }]}>
          <Ruler size={18} color={colors.primaryText} />
        </View>
        <Text
          style={{
            color: colors.ink,
            fontSize: fontSize.md,
            fontFamily: fontFamily.semiBold,
            marginStart: spacing.sm,
          }}>
          {s.editor.measurements}
        </Text>
      </View>
      {MEASUREMENT_FIELDS.map((field, index) => (
        <Controller
          key={field.key}
          control={control}
          name={`measurements.${field.key}`}
          render={({ field: { value, onChange } }) => (
            <MeasurementInput
              labelEn={field.labelEn}
              labelUr={field.labelUr}
              value={value}
              onChangeText={onChange}
              style={index === MEASUREMENT_FIELDS.length - 1 ? { marginBottom: 0 } : undefined}
            />
          )}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
