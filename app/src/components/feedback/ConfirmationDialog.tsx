import {
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useStrings } from '../../core/i18n/i18n';
import { useTheme } from '../../core/theme/ThemeProvider';
import { AppButton } from '../common/AppButton';

interface ConfirmationDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Makes the confirm button red (destructive actions). */
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const { theme } = useTheme();
  const s = useStrings();
  const { colors, spacing, radius, fontSize, fontFamily } = theme;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.45)', padding: spacing.xl }]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderRadius: radius.xl,
              padding: spacing.xl,
            },
          ]}>
          <Text
            style={[
              styles.title,
              {
                color: colors.ink,
                fontSize: fontSize.lg,
                fontFamily: fontFamily.bold,
                marginBottom: spacing.sm,
              },
            ]}>
            {title}
          </Text>
          <Text
            style={[
              styles.message,
              {
                color: colors.muted,
                fontSize: fontSize.md,
                fontFamily: fontFamily.regular,
                marginBottom: spacing.xl,
              },
            ]}>
            {message}
          </Text>
          <View style={[styles.buttons, { gap: spacing.sm }]}>
            <View style={styles.buttonFlex}>
              <AppButton
                title={cancelLabel ?? s.common.cancel}
                variant="ghost"
                onPress={onCancel}
                disabled={loading}
              />
            </View>
            <View style={styles.buttonFlex}>
              <AppButton
                title={confirmLabel ?? s.common.ok}
                variant={destructive ? 'danger' : 'primary'}
                onPress={onConfirm}
                loading={loading}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 400,
  },
  title: {
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
  },
  buttonFlex: {
    flex: 1,
  },
});
