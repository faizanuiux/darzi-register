// Local backup & restore.
//
// A backup is a FOLDER (not a zip) containing:
//   manifest.json  — { version, exportedAt, count, app }
//   customers.json — the full customer array
//
// ZIP UPGRADE PATH: single-file backups need `react-native-zip-archive`
// (not installed). When it is added: zip the backup folder in createBackup
// and return the .zip path; in restoreBackup, unzip to a temp dir first, then
// run the same folder-based logic below. The manifest validation stays
// identical, so existing folder backups keep working.
//
// Merge vs replace:
// - 'merge' adds only IDs that do not exist yet (existing records untouched).
// - 'replace' deletes EVERYTHING first, then adds all backup records. The
//   caller must confirm explicitly (the UI asks); here it additionally
//   requires the repository to expose delete() — otherwise a clear error.

import { TemporaryDirectoryPath } from 'react-native-fs';
import { ensureDir, readTextFile, writeTextFile } from '../files/fileService';
import type { Customer } from '../../types/customer';
import type { CustomerRepositoryLike } from '../import/repository';

export const BACKUP_VERSION = 1;
export const BACKUP_MANIFEST_NAME = 'manifest.json';
export const BACKUP_DATA_NAME = 'customers.json';

export interface BackupManifest {
  version: number;
  exportedAt: string;
  count: number;
  app: string;
}

export type RestoreMode = 'merge' | 'replace';

export interface RestoreResult {
  imported: number;
  skipped: number;
  total: number;
}

/** Write a backup folder into the temp dir; resolves the folder path. */
export async function createBackup(customers: Customer[]): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = `${TemporaryDirectoryPath}/darzi-backup-${stamp}`;
  await ensureDir(dir);

  const manifest: BackupManifest = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    count: customers.length,
    app: 'DarziRegister',
  };
  await writeTextFile(`${dir}/${BACKUP_MANIFEST_NAME}`, JSON.stringify(manifest, null, 2));
  await writeTextFile(`${dir}/${BACKUP_DATA_NAME}`, JSON.stringify(customers, null, 2));
  return dir;
}

/** Read and validate a backup's manifest (for previewing before restore). */
export async function previewBackup(dir: string): Promise<BackupManifest> {
  let raw: string;
  try {
    raw = await readTextFile(`${dir}/${BACKUP_MANIFEST_NAME}`);
  } catch {
    throw new Error('Not a Darzi Register backup: manifest.json is missing.');
  }
  let manifest: unknown;
  try {
    manifest = JSON.parse(raw);
  } catch {
    throw new Error('Backup is corrupt: manifest.json is not valid JSON.');
  }
  if (
    typeof manifest !== 'object' ||
    manifest === null ||
    (manifest as BackupManifest).version !== BACKUP_VERSION
  ) {
    throw new Error(
      `Unsupported backup version (expected ${BACKUP_VERSION}). ` +
        'This backup was made by a different app version.',
    );
  }
  return manifest as BackupManifest;
}

function assertCustomerShape(value: unknown, index: number): asserts value is Customer {
  const c = value as Partial<Customer>;
  if (typeof c !== 'object' || c === null) {
    throw new Error(`Backup is corrupt: record #${index + 1} is not an object.`);
  }
  if (typeof c.id !== 'string' || !c.id) {
    throw new Error(`Backup is corrupt: record #${index + 1} has no id.`);
  }
  if (typeof c.name !== 'string' || !c.name.trim()) {
    throw new Error(`Backup is corrupt: record #${index + 1} has no name.`);
  }
  if (typeof c.measurements !== 'object' || c.measurements === null) {
    throw new Error(`Backup is corrupt: record #${index + 1} has no measurements.`);
  }
  if (!Array.isArray(c.stitchingOptions)) {
    throw new Error(`Backup is corrupt: record #${index + 1} has no stitching options.`);
  }
}

/** Read and validate the customer array inside a backup folder. */
export async function readBackupCustomers(dir: string): Promise<Customer[]> {
  let raw: string;
  try {
    raw = await readTextFile(`${dir}/${BACKUP_DATA_NAME}`);
  } catch {
    throw new Error('Backup is corrupt: customers.json is missing.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Backup is corrupt: customers.json is not valid JSON.');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Backup is corrupt: customers.json must contain an array.');
  }
  parsed.forEach((item, index) => assertCustomerShape(item, index));
  return parsed as Customer[];
}

/**
 * Restore a backup folder into the repository.
 * Validates the manifest first and checks the record count matches.
 */
export async function restoreBackup(
  dir: string,
  repo: CustomerRepositoryLike,
  mode: RestoreMode,
): Promise<RestoreResult> {
  const manifest = await previewBackup(dir);
  const customers = await readBackupCustomers(dir);
  if (customers.length !== manifest.count) {
    throw new Error(
      `Backup is inconsistent: manifest says ${manifest.count} customers but the file holds ${customers.length}.`,
    );
  }

  if (mode === 'replace') {
    if (!repo.delete) {
      throw new Error(
        'Replace restore is unavailable: the customer repository does not expose delete(). ' +
          'Use merge mode, or wire delete support into the repository.',
      );
    }
    const existing = await repo.getAll();
    for (const customer of existing) {
      // `delete` is checked above; the non-null assertion is guarded by it.
      await repo.delete(customer.id);
    }
  }

  let imported = 0;
  let skipped = 0;
  for (const customer of customers) {
    const alreadyThere = await repo.getById(customer.id);
    if (alreadyThere) {
      skipped += 1;
      continue;
    }
    const { id, ...rest } = customer;
    await repo.create({ ...rest, id });
    imported += 1;
  }

  return { imported, skipped, total: customers.length };
}
