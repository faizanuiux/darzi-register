import { ChevronRight, Pencil, Trash2 } from 'lucide-react-native';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDirection } from '../../core/i18n/i18n';
import { useTheme } from '../../core/theme/ThemeProvider';
import type { Customer } from '../../types/customer';
import { CustomerAvatar } from './CustomerAvatar';

interface CustomerCardProps {
  customer: Customer;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function CustomerCard({ customer, onPress, onDelete, onEdit }: CustomerCardProps) {
  const { theme } = useTheme();
  const dir = useDirection();
  const { colors, spacing, radius, fontSize, fontFamily } = theme;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={customer.name}
      style={[
        styles.card,
        {
          flexDirection: dir.rowDirection,
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          padding: spacing.md,
          marginBottom: spacing.sm,
        },
      ]}>
      <CustomerAvatar photoPath={customer.photoPath} name={customer.name} size={54} />
      <View style={[styles.info, { marginHorizontal: spacing.md }]}>
        <Text
          numberOfLines={1}
          style={[
            styles.name,
            { color: colors.ink, fontSize: fontSize.md, fontFamily: fontFamily.semiBold, textAlign: dir.textStart },
          ]}>
          {customer.name}
        </Text>
        <Text
          numberOfLines={1}
          style={{ color: colors.muted, fontSize: fontSize.sm, fontFamily: fontFamily.regular, textAlign: dir.textStart }}>
          {customer.phone}
        </Text>
        {customer.notes.trim() ? (
          <Text
            numberOfLines={1}
            style={[
              styles.notes,
              { color: colors.muted, fontSize: fontSize.xs, fontFamily: fontFamily.regular, marginTop: spacing.xs, textAlign: dir.textStart },
            ]}>
            {customer.notes}
          </Text>
        ) : null}
      </View>
      <View style={[styles.actions, { flexDirection: dir.rowDirection }]}>
        <TouchableOpacity
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${customer.name}`}
          hitSlop={10}
          style={[styles.iconButton, { backgroundColor: colors.primarySoft }]}>
          <Pencil size={16} color={colors.primaryText} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${customer.name}`}
          hitSlop={10}
          style={[styles.iconButton, { backgroundColor: colors.dangerSoft }]}>
          <Trash2 size={16} color={colors.danger} />
        </TouchableOpacity>
        {/* Directional icon: forward chevron points left in RTL. */}
        <ChevronRight size={18} color={colors.muted} style={dir.flip} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  info: {
    flex: 1,
  },
  name: {},
  notes: {
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
