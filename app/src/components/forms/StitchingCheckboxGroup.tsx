import { Check, Scissors } from 'lucide-react-native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { STITCHING_OPTIONS } from '../../core/constants/fields';
import { useStrings } from '../../core/i18n/i18n';
import { useTheme } from '../../core/theme/ThemeProvider';
import type { StitchingOptionKey } from '../../types/customer';

interface StitchingCheckboxGroupProps {
  value: StitchingOptionKey[];
  onChange: (next: StitchingOptionKey[]) => void;
}

/** Multi-select checkbox group rendering all 8 options from STITCHING_OPTIONS. */
export function StitchingCheckboxGroup({ value, onChange }: StitchingCheckboxGroupProps) {
  const { theme } = useTheme();
  const s = useStrings();
  const { colors, spacing, radius, fontSize, fontFamily } = theme;

  const toggle = (key: StitchingOptionKey) => {
    onChange(
      value.includes(key) ? value.filter(k => k !== key) : [...value, key],
    );
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          padding: spacing.lg,
        },
      ]}>
      <View style={[styles.headingRow, { marginBottom: spacing.md }]}>
        <View style={[styles.iconBadge, { backgroundColor: colors.accentSoft }]}>
          <Scissors size={18} color={colors.accentDark} />
        </View>
        <Text
          style={{
            color: colors.ink,
            fontSize: fontSize.md,
            fontFamily: fontFamily.semiBold,
            marginStart: spacing.sm,
          }}>
          {s.editor.stitching}
        </Text>
      </View>
      <View style={[styles.grid, { gap: spacing.sm }]}>
        {STITCHING_OPTIONS.map(option => {
          const selected = value.includes(option.key);
          return (
            <TouchableOpacity
              key={option.key}
              onPress={() => toggle(option.key)}
              activeOpacity={0.7}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${option.labelEn} / ${option.labelUr}`}
              style={[
                styles.chip,
                {
                  borderColor: selected ? colors.primaryText : colors.line,
                  backgroundColor: selected ? colors.primarySoft : colors.card,
                  borderRadius: radius.md,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                },
              ]}>
              <View
                style={[
                  styles.box,
                  {
                    borderColor: selected ? colors.primary : colors.muted,
                    backgroundColor: selected ? colors.primary : 'transparent',
                    borderRadius: radius.sm,
                    marginEnd: spacing.sm,
                  },
                ]}>
                {selected ? <Check size={13} color={colors.white} strokeWidth={3.5} /> : null}
              </View>
              <View style={styles.labels}>
                <Text
                  numberOfLines={1}
                  style={{
                    color: selected ? colors.primaryText : colors.ink,
                    fontSize: fontSize.sm,
                    fontFamily: selected ? fontFamily.semiBold : fontFamily.regular,
                  }}>
                  {option.labelEn}
                </Text>
                <Text numberOfLines={1} style={{ color: colors.muted, fontSize: fontSize.xs, fontFamily: fontFamily.regular }}>
                  {option.labelUr}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    minWidth: '47%',
    flexGrow: 1,
  },
  box: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labels: {
    flex: 1,
  },
});
