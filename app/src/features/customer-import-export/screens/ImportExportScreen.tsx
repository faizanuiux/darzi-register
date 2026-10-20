// Import / Export screen.
//
// Works today: Export CSV (generate → share), Create backup, Export PDF
// (single customer, opened from customer details with a customerId).
// Honest stubs: Import CSV and picking an existing backup need a document
// picker (@react-native-documents/picker) — the buttons say so instead of
// pretending. Restore works from the backup created in this session.
//
// This screen is navigation-agnostic: the parent supplies localized strings,
// the repository (DI), and an onClose callback; the parent's navigator wires
// it in (e.g. from Settings → Import/Export).

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { TemporaryDirectoryPath } from 'react-native-fs';
import {
  Check,
  Cloud,
  DatabaseBackup,
  Download,
  FileText,
  RotateCcw,
  Upload,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { Strings } from '../../../localization/en/common';
import { AppHeader } from '../../../components/common';
import { useTheme } from '../../../core/theme/ThemeProvider';
import type { CustomerRepositoryLike } from '../../../services/import/repository';
import { exportCustomers } from '../../../services/export/csvExport';
import { generateCustomerPdf } from '../../../services/export/pdfExport';
import { createBackup, previewBackup, restoreBackup } from '../../../services/export/backupService';
import { driveService } from '../../../services/export/driveService';
import { pickCsv, shareFile, writeTextFile } from '../../../services/files/fileService';

export interface ImportExportScreenProps {
  strings: Strings;
  repo: CustomerRepositoryLike;
  /** Pass from customer details to enable single-customer PDF export. */
  customerId?: string;
  onClose?: () => void;
}

function ActionRow({
  icon: Icon,
  label,
  description,
  onPress,
  disabled,
  danger,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  onPress: () => void;
  disabled: boolean;
  danger?: boolean;
  tone: 'primary' | 'accent';
}) {
  const { theme } = useTheme();
  const { colors, spacing, radius, fontSize, fontFamily } = theme;
  const badgeBg = danger ? colors.dangerSoft : tone === 'primary' ? colors.primarySoft : colors.accentSoft;
  const badgeFg = danger ? colors.danger : tone === 'primary' ? colors.primary : colors.accentDark;

  return (
    <TouchableOpacity
      style={[
        styles.row,
        {
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          padding: spacing.md,
          marginBottom: spacing.sm,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}>
      <View style={[styles.rowIcon, { backgroundColor: badgeBg }]}>
        <Icon size={20} color={badgeFg} />
      </View>
      <View style={styles.rowText}>
        <Text
          style={{
            fontSize: fontSize.md,
            fontFamily: fontFamily.semiBold,
            color: danger ? colors.danger : colors.ink,
          }}>
          {label}
        </Text>
        <Text
          style={{
            fontSize: fontSize.xs,
            fontFamily: fontFamily.regular,
            color: colors.muted,
            marginTop: 2,
          }}>
          {description}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export function ImportExportScreen({ strings, repo, customerId, onClose }: ImportExportScreenProps) {
  const { theme } = useTheme();
  const { colors, spacing, radius, fontSize, fontFamily } = theme;
  const t = strings.importExport;
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [lastBackupDir, setLastBackupDir] = useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<string>) => {
    setBusy(true);
    setStatus('');
    try {
      const message = await fn();
      setStatus(message);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      setStatus(`${label}: ${detail}`);
    } finally {
      setBusy(false);
    }
  };

  const onExportCsv = () =>
    run(t.exportCsv, async () => {
      const customers = await repo.getAll();
      const csv = exportCustomers(customers);
      const stamp = new Date().toISOString().slice(0, 10);
      const path = `${TemporaryDirectoryPath}/darzi-customers-${stamp}.csv`;
      await writeTextFile(path, csv);
      await shareFile(path, 'text/csv', t.exportCsv);
      return `${t.exportCsv}: ${customers.length} — done`;
    });

  const onImportCsv = () =>
    run(t.importCsv, async () => {
      // Honest stub until @react-native-documents/picker is wired.
      await pickCsv();
      return '';
    });

  const onExportPdf = () =>
    run(t.exportPdf, async () => {
      if (!customerId) {
        throw new Error('Open this from a customer’s details screen to export their PDF.');
      }
      const customer = await repo.getById(customerId);
      if (!customer) {
        throw new Error('Customer not found.');
      }
      const pdfPath = await generateCustomerPdf(customer);
      await shareFile(pdfPath, 'application/pdf', t.exportPdf);
      return `${t.exportPdf}: ${customer.name} — done`;
    });

  const onCreateBackup = () =>
    run(t.backup, async () => {
      const customers = await repo.getAll();
      const dir = await createBackup(customers);
      setLastBackupDir(dir);
      return `${t.backup}: ${customers.length} — done (${dir})`;
    });

  const onRestore = () => {
    if (!lastBackupDir) {
      Alert.alert(
        t.restore,
        'No backup to restore yet — create one first. (Picking an existing backup file needs a document picker, coming soon.)',
        [{ text: strings.common.ok }],
      );
      return;
    }
    Alert.alert(t.restore, 'How should the backup be applied?', [
      { text: strings.common.cancel, style: 'cancel' },
      {
        text: 'Merge (keep existing)',
        onPress: () =>
          run(t.restore, async () => {
            const manifest = await previewBackup(lastBackupDir);
            const result = await restoreBackup(lastBackupDir as string, repo, 'merge');
            return `${t.restore}: +${result.imported}, kept ${result.skipped} (backup had ${manifest.count}) — done`;
          }),
      },
      {
        text: 'Replace (delete all first)',
        style: 'destructive',
        onPress: () =>
          run(t.restore, async () => {
            const manifest = await previewBackup(lastBackupDir);
            const result = await restoreBackup(lastBackupDir as string, repo, 'replace');
            return `${t.restore}: +${result.imported}, removed existing (backup had ${manifest.count}) — done`;
          }),
      },
    ]);
  };

  const onDrive = () => {
    // Stub: always throws until docs/GOOGLE-DRIVE-SETUP.md is completed.
    try {
      driveService.isConfigured();
      Alert.alert(t.driveBackup, t.driveSoon, [{ text: strings.common.ok }]);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      Alert.alert(t.driveBackup, detail, [{ text: strings.common.ok }]);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AppHeader variant="brand" title={t.title} onBack={onClose} />
      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg }]}>
        <Text
          style={[
            styles.groupTitle,
            { color: colors.muted, fontSize: fontSize.sm, fontFamily: fontFamily.semiBold, marginBottom: spacing.sm },
          ]}>
          {t.title}
        </Text>

        <ActionRow icon={Download} label={t.exportCsv} description={t.exportCsvDesc} onPress={onExportCsv} disabled={busy} tone="primary" />
        <ActionRow icon={Upload} label={t.importCsv} description={t.importCsvDesc} onPress={onImportCsv} disabled={busy} tone="primary" />
        <ActionRow
          icon={FileText}
          label={t.exportPdf}
          description={t.exportPdfDesc}
          onPress={onExportPdf}
          disabled={busy || !customerId}
          tone="primary"
        />
        {!customerId && (
          <Text style={[styles.hint, { color: colors.muted, fontSize: fontSize.sm, fontFamily: fontFamily.regular, marginBottom: spacing.sm }]}>
            PDF export needs a customer — open it from customer details.
          </Text>
        )}

        <Text
          style={[
            styles.groupTitle,
            { color: colors.muted, fontSize: fontSize.sm, fontFamily: fontFamily.semiBold, marginTop: spacing.lg, marginBottom: spacing.sm },
          ]}>
          {strings.settings.backup}
        </Text>
        <ActionRow icon={DatabaseBackup} label={t.backup} description={t.backupDesc} onPress={onCreateBackup} disabled={busy} tone="accent" />
        <ActionRow icon={RotateCcw} label={t.restore} description={t.restoreDesc} onPress={onRestore} disabled={busy} danger tone="accent" />
        <ActionRow icon={Cloud} label={t.driveBackup} description={t.driveDesc} onPress={onDrive} disabled={busy} tone="accent" />

        {busy && <ActivityIndicator style={[styles.spinner, { marginTop: spacing.lg }]} size="large" color={colors.primaryText} />}
        {status !== '' && (
          <View
            style={[
              styles.statusCard,
              { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.lg },
            ]}>
            <View style={styles.statusRow}>
              <Check size={16} color={colors.successText} />
              <Text
                style={[
                  styles.status,
                  { color: colors.ink, fontSize: fontSize.sm, fontFamily: fontFamily.regular, marginStart: spacing.sm },
                ]}>
                {status}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {},
  groupTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    marginStart: 12,
  },
  hint: {},
  spinner: {},
  statusCard: {
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  status: {
    flex: 1,
  },
});
