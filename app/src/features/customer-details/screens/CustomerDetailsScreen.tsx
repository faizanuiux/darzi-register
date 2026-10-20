import { useCallback, useEffect, useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Calendar, Check, Phone, Pencil, Ruler, Scissors, Shirt, Trash2, UserX } from 'lucide-react-native';
import { AppButton, AppHeader } from '../../../components/common';
import { CustomerAvatar } from '../../../components/customers';
import { ConfirmationDialog, EmptyState, LoadingIndicator, useToast } from '../../../components/feedback';
import { MEASUREMENT_FIELDS, STITCHING_OPTIONS } from '../../../core/constants/fields';
import { useStrings } from '../../../core/i18n/i18n';
import { useTheme } from '../../../core/theme/ThemeProvider';
import type { CustomerDetailsScreenProps } from '../../../app/navigation/types';
import type { Customer } from '../../../types/customer';
import { getCustomerDataSource } from '../../customers/services/customerDataSource';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

/** The first seven measurement fields are kameez-related; the last two are salwar. */
const KAMEEZ_FIELDS = MEASUREMENT_FIELDS.slice(0, 7);
const SALWAR_FIELDS = MEASUREMENT_FIELDS.slice(7);

export function CustomerDetailsScreen({ navigation, route }: CustomerDetailsScreenProps) {
  const { theme } = useTheme();
  const s = useStrings();
  const toast = useToast();
  const { colors, spacing, radius, fontSize, fontFamily } = theme;

  // This route is only ever navigated to with a customerId.
  const { customerId } = route.params as { customerId: string };

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadCustomer = useCallback(async () => {
    try {
      const found = await getCustomerDataSource().getById(customerId);
      setCustomer(found);
    } catch {
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    void loadCustomer();
  }, [loadCustomer]);

  // Re-read on focus so edits made in the editor show immediately.
  useFocusEffect(
    useCallback(() => {
      void loadCustomer();
    }, [loadCustomer]),
  );

  const callCustomer = () => {
    if (customer) {
      void Linking.openURL(`tel:${customer.phone}`);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await getCustomerDataSource().delete(customerId);
      toast.showToast(s.customers.deleted);
      setShowDelete(false);
      navigation.goBack();
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="" />
        <LoadingIndicator label={s.common.loading} />
      </View>
    );
  }

  if (!customer) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="" />
        <EmptyState
          icon={UserX}
          title={s.customers.noResults}
          actionLabel={s.common.ok}
          onAction={() => navigation.goBack()}
        />
      </View>
    );
  }

  const selectedStitching = new Set(customer.stitchingOptions);

  const renderMeasurementCard = (
    title: string,
    icon: typeof Ruler,
    fields: typeof MEASUREMENT_FIELDS,
  ) => (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          marginBottom: spacing.lg,
        },
      ]}>
      <View style={[styles.cardHeader, { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm }]}>
        <View style={[styles.iconBadge, { backgroundColor: colors.primarySoft }]}>
          {(() => { const Icon = icon; return <Icon size={16} color={colors.primaryText} />; })()}
        </View>
        <Text
          style={{
            color: colors.ink,
            fontSize: fontSize.md,
            fontFamily: fontFamily.semiBold,
            marginStart: spacing.sm,
          }}>
          {title}
        </Text>
      </View>
      {fields.map((field, index) => {
        const raw = customer.measurements[field.key];
        const value = raw && raw.trim() ? raw : '–';
        return (
          <View
            key={field.key}
            style={[
              styles.kvRow,
              {
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                borderTopColor: colors.line,
                borderTopWidth: index === 0 ? 0 : 1,
              },
            ]}>
            <View style={styles.kvLabel}>
              <Text style={{ color: colors.ink, fontSize: fontSize.sm, fontFamily: fontFamily.semiBold }}>
                {field.labelEn}
              </Text>
              <Text style={{ color: colors.muted, fontSize: fontSize.xs, fontFamily: fontFamily.regular }}>
                {field.labelUr}
              </Text>
            </View>
            <Text
              style={{
                color: value === '–' ? colors.muted : colors.ink,
                fontSize: fontSize.md,
                fontFamily: fontFamily.medium,
              }}>
              {value}
            </Text>
          </View>
        );
      })}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader variant="brand" title={customer.name} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
        ]}>
        {/* Identity */}
        <View
          style={[
            styles.identityCard,
            {
              backgroundColor: colors.card,
              borderRadius: radius.lg,
              padding: spacing.lg,
              marginBottom: spacing.lg,
            },
          ]}>
          <CustomerAvatar photoPath={customer.photoPath} name={customer.name} size={84} />
          <Text
            style={[
              styles.name,
              {
                color: colors.ink,
                fontSize: fontSize.xl,
                fontFamily: fontFamily.bold,
                marginTop: spacing.sm,
              },
            ]}>
            {customer.name}
          </Text>
          <TouchableOpacity
            onPress={callCustomer}
            accessibilityRole="button"
            accessibilityLabel={`${s.details.call} ${customer.phone}`}
            style={[
              styles.phoneRow,
              {
                backgroundColor: colors.primarySoft,
                borderRadius: radius.pill,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.lg,
                marginTop: spacing.sm,
              },
            ]}>
            <Phone size={16} color={colors.primaryText} />
            <Text
              style={{
                color: colors.primaryText,
                fontSize: fontSize.md,
                fontFamily: fontFamily.semiBold,
                marginStart: spacing.xs,
              }}>
              {customer.phone}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Measurements */}
        {renderMeasurementCard(s.details.kameez, Shirt, KAMEEZ_FIELDS)}
        {renderMeasurementCard(s.details.salwar, Ruler, SALWAR_FIELDS)}

        {/* Stitching */}
        <View style={[styles.sectionHeader, { marginBottom: spacing.sm }]}>
          <View style={[styles.iconBadge, { backgroundColor: colors.accentSoft }]}>
            <Scissors size={16} color={colors.accentDark} />
          </View>
          <Text
            style={{
              color: colors.ink,
              fontSize: fontSize.md,
              fontFamily: fontFamily.semiBold,
              marginStart: spacing.sm,
            }}>
            {s.details.stitching}
          </Text>
        </View>
        <View style={[styles.stitchGrid, { gap: spacing.sm, marginBottom: spacing.lg }]}>
          {STITCHING_OPTIONS.map(option => {
            const selected = selectedStitching.has(option.key);
            return (
              <View
                key={option.key}
                style={[
                  styles.stitchChip,
                  {
                    borderColor: selected ? colors.primary : colors.line,
                    backgroundColor: selected ? colors.primarySoft : colors.card,
                    borderRadius: radius.md,
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.md,
                  },
                ]}>
                <View
                  style={[
                    styles.stitchBox,
                    {
                      borderColor: selected ? colors.primary : colors.muted,
                      backgroundColor: selected ? colors.primary : 'transparent',
                      borderRadius: radius.sm,
                      marginEnd: spacing.xs,
                    },
                  ]}>
                  {selected ? <Check size={12} color={colors.white} strokeWidth={3.5} /> : null}
                </View>
                <View style={styles.stitchLabels}>
                  <Text
                    style={{
                      color: selected ? colors.ink : colors.muted,
                      fontSize: fontSize.sm,
                      fontFamily: selected ? fontFamily.semiBold : fontFamily.regular,
                    }}>
                    {option.labelEn}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: fontSize.xs, fontFamily: fontFamily.regular }}>
                    {option.labelUr}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Notes */}
        {customer.notes.trim() ? (
          <>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: colors.ink,
                  fontSize: fontSize.md,
                  fontFamily: fontFamily.semiBold,
                  marginBottom: spacing.sm,
                },
              ]}>
              {s.details.notes}
            </Text>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  marginBottom: spacing.lg,
                },
              ]}>
              <Text style={{ color: colors.ink, fontSize: fontSize.md, fontFamily: fontFamily.regular }}>
                {customer.notes}
              </Text>
            </View>
          </>
        ) : null}

        {/* Timestamps */}
        <View style={[styles.metaRow, { marginBottom: spacing.xs }]}>
          <Calendar size={13} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: fontSize.xs, fontFamily: fontFamily.regular, marginStart: spacing.xs }}>
            {s.details.created}: {formatDate(customer.createdAt)}
          </Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: fontSize.xs, fontFamily: fontFamily.regular, marginBottom: spacing.lg }}>
          {s.details.updated}: {formatDate(customer.updatedAt)}
        </Text>

        {/* Actions */}
        <View style={[styles.actions, { gap: spacing.sm }]}>
          <View style={styles.actionFlex}>
            <AppButton
              title={s.common.edit}
              icon={Pencil}
              onPress={() => navigation.navigate('CustomerEditor', { customerId })}
            />
          </View>
          <View style={styles.actionFlex}>
            <AppButton
              title={s.common.delete}
              icon={Trash2}
              variant="danger"
              onPress={() => setShowDelete(true)}
            />
          </View>
        </View>
      </ScrollView>
      <ConfirmationDialog
        visible={showDelete}
        title={s.common.delete}
        message={s.customers.confirmDelete}
        confirmLabel={s.common.delete}
        destructive
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setShowDelete(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  identityCard: {
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  name: {
    textAlign: 'center',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    textAlign: 'left',
  },
  card: {
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  kvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kvLabel: {
    flex: 1,
    marginEnd: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stitchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  stitchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    minWidth: '47%',
    flexGrow: 1,
  },
  stitchBox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stitchLabels: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
  },
  actionFlex: {
    flex: 1,
  },
});
