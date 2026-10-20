import { Search, X } from 'lucide-react-native';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useDirection, useStrings } from '../../core/i18n/i18n';
import { useTheme } from '../../core/theme/ThemeProvider';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  style?: StyleProp<ViewStyle>;
}

export function SearchBar({ value, onChangeText, style }: SearchBarProps) {
  const { theme } = useTheme();
  const s = useStrings();
  const dir = useDirection();
  const { colors, spacing, radius, fontSize, fontFamily } = theme;

  return (
    <View
      style={[
        styles.container,
        {
          flexDirection: dir.rowDirection,
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          paddingHorizontal: spacing.md,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.sm,
        },
        style,
      ]}>
      <Search size={18} color={colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={s.common.search}
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        clearButtonMode="while-editing"
        accessibilityLabel={s.common.search}
        style={[
          styles.input,
          {
            color: colors.ink,
            fontSize: fontSize.md,
            fontFamily: fontFamily.regular,
            paddingVertical: spacing.sm,
            textAlign: dir.textStart,
          },
          dir.marginStart(spacing.sm),
        ]}
      />
      {value.length > 0 ? (
        <TouchableOpacity
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel={s.common.cancel}
          hitSlop={10}
          style={styles.clearButton}>
          <X size={16} color={colors.muted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  input: {
    flex: 1,
  },
  clearButton: {
    padding: 4,
  },
});
