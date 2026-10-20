import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { Camera, Check, ImagePlus, Trash2, User } from 'lucide-react-native';
import { AppButton, AppHeader, AppTextInput } from '../../../components/common';
import { CustomerAvatar } from '../../../components/customers';
import { ConfirmationDialog, LoadingIndicator, useToast } from '../../../components/feedback';
import { StitchingCheckboxGroup } from '../../../components/forms';
import { MeasurementSection } from '../../../components/measurements';
import { useStrings } from '../../../core/i18n/i18n';
import { useTheme } from '../../../core/theme/ThemeProvider';
import type { CustomerEditorScreenProps } from '../../../app/navigation/types';
import type { Customer } from '../../../types/customer';
import { EMPTY_MEASUREMENTS } from '../../../types/customer';
import { getCustomerDataSource } from '../../customers/services/customerDataSource';
import {
  createCustomerFormSchema,
  type CustomerFormValues,
} from '../validation/customerFormSchema';

/**
 * Single reusable editor for creating and editing customers.
 * Route param customerId present = edit mode, omitted = create mode.
 */
export function CustomerEditorScreen({ navigation, route }: CustomerEditorScreenProps) {
  const { theme } = useTheme();
  const s = useStrings();
  const toast = useToast();
  const { colors, spacing, radius, fontSize, fontFamily } = theme;

  const customerId = route.params?.customerId;
  const isEdit = customerId !== undefined;

  const schema = useMemo(() => createCustomerFormSchema(s), [s]);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      phone: '',
      photoPath: null,
      measurements: { ...EMPTY_MEASUREMENTS },
      stitchingOptions: [],
      notes: '',
    },
  });

  const [loadingCustomer, setLoadingCustomer] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const photoPath = watch('photoPath');
  const nameValue = watch('name');

  // Load the existing customer in edit mode and hydrate the form.
  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    (async () => {
      try {
        const existing: Customer | null = await getCustomerDataSource().getById(customerId);
        if (cancelled) return;
        if (!existing) {
          navigation.goBack();
          return;
        }
        reset({
          name: existing.name,
          phone: existing.phone,
          photoPath: existing.photoPath,
          measurements: { ...existing.measurements },
          stitchingOptions: [...existing.stitchingOptions],
          notes: existing.notes,
        });
      } catch {
        if (!cancelled) navigation.goBack();
      } finally {
        if (!cancelled) setLoadingCustomer(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId, navigation, reset]);

  const pickPhoto = (fromCamera: boolean) => {
    const launch = fromCamera ? launchCamera : launchImageLibrary;
    launch({ mediaType: 'photo', quality: 0.8 }, response => {
      if (response.didCancel || response.errorCode) return;
      const uri = response.assets?.[0]?.uri;
      if (uri) {
        // TODO(image-service): route this picker URI through the image service
        // (compress + copy into app-managed storage) before saving, and store
        // the resulting app-relative path as photoPath. Until then the raw
        // picker URI is stored directly and may not survive gallery cleanup.
        setValue('photoPath', uri, { shouldDirty: true });
      }
    });
  };

  const removePhoto = () => {
    setValue('photoPath', null, { shouldDirty: true });
  };

  const onSubmit = async (values: CustomerFormValues) => {
    setSaving(true);
    try {
      const ds = getCustomerDataSource();
      if (isEdit && customerId) {
        const existing = await ds.getById(customerId);
        if (!existing) {
          navigation.goBack();
          return;
        }
        await ds.update({
          ...existing,
          name: values.name,
          phone: values.phone,
          photoPath: values.photoPath,
          measurements: values.measurements,
          stitchingOptions: values.stitchingOptions,
          notes: values.notes,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await ds.create({
          name: values.name,
          phone: values.phone,
          photoPath: values.photoPath,
          measurements: values.measurements,
          stitchingOptions: values.stitchingOptions,
          notes: values.notes,
        });
      }
      toast.showToast(s.customers.saved);
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (isDirty) {
      setShowDiscard(true);
    } else {
      navigation.goBack();
    }
  };

  if (loadingCustomer) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader
          title={isEdit ? s.editor.editTitle : s.editor.newTitle}
          onBack={handleBack}
        />
        <LoadingIndicator label={s.common.loading} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={isEdit ? s.editor.editTitle : s.editor.newTitle}
        onBack={handleBack}
        actions={[
          {
            label: 'save',
            icon: Check,
            accessibilityLabel: s.common.save,
            onPress: () => void handleSubmit(onSubmit)(),
          },
        ]}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
        ]}>
        {/* Photo */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderRadius: radius.lg,
              padding: spacing.lg,
              marginBottom: spacing.lg,
            },
          ]}>
          <View style={[styles.cardTitleRow, { marginBottom: spacing.md }]}>
            <View style={[styles.iconBadge, { backgroundColor: colors.primarySoft }]}>
              <Camera size={16} color={colors.primaryText} />
            </View>
            <Text
              style={{
                color: colors.ink,
                fontSize: fontSize.md,
                fontFamily: fontFamily.semiBold,
                marginStart: spacing.sm,
              }}>
              {s.editor.photo}
            </Text>
          </View>
          <View style={styles.photoRow}>
            <CustomerAvatar photoPath={photoPath} name={nameValue || '?'} size={84} />
            <View style={[styles.photoButtons, { marginStart: spacing.md, gap: spacing.sm }]}>
              <AppButton
                title={s.editor.takePhoto}
                icon={Camera}
                variant="secondary"
                onPress={() => pickPhoto(true)}
              />
              <AppButton
                title={s.editor.choosePhoto}
                icon={ImagePlus}
                variant="secondary"
                onPress={() => pickPhoto(false)}
              />
              {photoPath ? (
                <AppButton
                  title={s.editor.removePhoto}
                  icon={Trash2}
                  variant="ghost"
                  onPress={removePhoto}
                />
              ) : null}
            </View>
          </View>
        </View>

        {/* Identity */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderRadius: radius.lg,
              padding: spacing.lg,
              marginBottom: spacing.lg,
            },
          ]}>
          <View style={[styles.cardTitleRow, { marginBottom: spacing.md }]}>
            <View style={[styles.iconBadge, { backgroundColor: colors.accentSoft }]}>
              <User size={16} color={colors.accentDark} />
            </View>
            <Text
              style={{
                color: colors.ink,
                fontSize: fontSize.md,
                fontFamily: fontFamily.semiBold,
                marginStart: spacing.sm,
              }}>
              {s.editor.identity}
            </Text>
          </View>
          <Controller
            control={control}
            name="name"
            render={({ field: { value, onChange, onBlur } }) => (
              <AppTextInput
                label={s.editor.name}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="words"
                returnKeyType="next"
                error={errors.name?.message}
                containerStyle={{ marginBottom: spacing.md }}
              />
            )}
          />
          <Controller
            control={control}
            name="phone"
            render={({ field: { value, onChange, onBlur } }) => (
              <AppTextInput
                label={s.editor.phone}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="phone-pad"
                error={errors.phone?.message}
              />
            )}
          />
        </View>

        {/* Measurements */}
        <MeasurementSection control={control} style={{ marginBottom: spacing.lg }} />

        {/* Stitching */}
        <View style={{ marginBottom: spacing.lg }}>
          <StitchingCheckboxGroup
            value={watch('stitchingOptions') ?? []}
            onChange={value => setValue('stitchingOptions', value, { shouldDirty: true })}
          />
        </View>

        {/* Notes */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderRadius: radius.lg,
              padding: spacing.lg,
              marginBottom: spacing.lg,
            },
          ]}>
          <Controller
            control={control}
            name="notes"
            render={({ field: { value, onChange, onBlur } }) => (
              <AppTextInput
                label={s.editor.notes}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholder={s.editor.notesPlaceholder}
              />
            )}
          />
        </View>

        <AppButton
          title={s.common.save}
          icon={Check}
          onPress={() => void handleSubmit(onSubmit)()}
          loading={saving}
        />
      </ScrollView>
      <ConfirmationDialog
        visible={showDiscard}
        title={s.editor.discardTitle}
        message={s.editor.discardMsg}
        confirmLabel={s.common.yes}
        cancelLabel={s.common.no}
        destructive
        onConfirm={() => {
          setShowDiscard(false);
          navigation.goBack();
        }}
        onCancel={() => setShowDiscard(false)}
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
  card: {
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  cardTitleRow: {
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
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoButtons: {
    flex: 1,
  },
});
