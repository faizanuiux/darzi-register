// CSV import: parse + validate a CSV file, then insert into the repository.
//
// Safety rules:
// - Headers must match the export format exactly (order included); anything
//   else is reported as an error, never guessed.
// - Rows are validated one by one; bad rows are skipped with a message, they
//   never abort the whole import and never crash the parser.
// - Duplicate IDs inside the file are rejected (first occurrence wins).
// - The `strategy` is explicit: 'add' NEVER overwrites an existing ID
//   (it skips), 'update' overwrites. There is no silent-overwrite path.
// - The picker flow (importAsNewCustomers) is the exception by design:
//   it imports every validated row as a NEW record with a fresh id and
//   no photo — see its doc block.

import Papa from 'papaparse';
import type { Customer, MeasurementKey, StitchingOptionKey } from '../../types/customer';
import { EMPTY_MEASUREMENTS } from '../../types/customer';
import { MEASUREMENT_KEYS, STITCHING_KEYS } from '../../core/constants/fields';
import { CSV_COLUMNS } from '../export/csvExport';
import type { CustomerRepositoryLike } from './repository';

export interface ParseOutcome {
  /** Fully validated customers, in file order. */
  rows: Customer[];
  /** Human-readable problems; empty means the file was clean. */
  errors: string[];
  /**
   * True when the file carried the exact Darzi Register export header —
   * false means "not one of our files" (empty file, unparseable, or a
   * foreign CSV), which the UI reports differently from bad rows.
   */
  headerValid: boolean;
  /**
   * Data rows that were present but rejected during validation
   * (missing name/phone, bad stitching value, duplicate id, …).
   */
  skipped: number;
}

export type ImportStrategy = 'add' | 'update';

export interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

function isStitchingValue(value: string): value is '1' | '0' | '' {
  return value === '1' || value === '0' || value === '';
}

function rowToCustomer(record: Record<string, string>, lineNo: number): Customer {
  const id = (record.id ?? '').trim();
  if (!id) {
    throw new Error(`row ${lineNo}: missing customer id.`);
  }
  const name = (record.name ?? '').trim();
  if (!name) {
    throw new Error(`row ${lineNo}: missing customer name.`);
  }
  const phone = (record.phone ?? '').trim();
  if (!phone) {
    throw new Error(`row ${lineNo}: missing phone number.`);
  }

  const measurements = { ...EMPTY_MEASUREMENTS };
  for (const key of MEASUREMENT_KEYS) {
    const typedKey = key as MeasurementKey;
    measurements[typedKey] = (record[key] ?? '').trim();
  }

  const stitchingOptions: StitchingOptionKey[] = [];
  for (const key of STITCHING_KEYS) {
    const raw = (record[key] ?? '').trim();
    if (!isStitchingValue(raw)) {
      throw new Error(
        `row ${lineNo}: stitching column "${key}" must be 1 or 0, got "${raw}".`,
      );
    }
    if (raw === '1') {
      stitchingOptions.push(key as StitchingOptionKey);
    }
  }

  const now = new Date().toISOString();
  return {
    id,
    name,
    phone,
    photoPath: (record.photo_path ?? '').trim() || null,
    measurements,
    stitchingOptions,
    notes: (record.notes ?? '').trim(),
    createdAt: (record.created_at ?? '').trim() || now,
    updatedAt: (record.updated_at ?? '').trim() || now,
  };
}

/**
 * Parse CSV text into validated Customer rows.
 * Never throws on malformed input — problems come back in `errors`.
 */
export function parseCsv(text: string): ParseOutcome {
  const errors: string[] = [];
  const rows: Customer[] = [];

  if (!text.trim()) {
    return { rows, errors: ['The file is empty.'], headerValid: false, skipped: 0 };
  }

  let parsed;
  try {
    parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return {
      rows,
      errors: [`Could not parse the CSV file: ${detail}`],
      headerValid: false,
      skipped: 0,
    };
  }

  // papaparse strips a UTF-8 BOM from the first header automatically.
  const fields = parsed.meta.fields ?? [];
  const expected = [...CSV_COLUMNS];
  const headersMatch =
    fields.length === expected.length && fields.every((f, i) => f === expected[i]);
  if (!headersMatch) {
    const missing = expected.filter(c => !fields.includes(c));
    const unexpected = fields.filter(f => !(expected as readonly string[]).includes(f));
    const detail = [
      missing.length > 0 ? `missing: ${missing.join(', ')}` : null,
      unexpected.length > 0 ? `unexpected: ${unexpected.join(', ')}` : null,
      missing.length === 0 && unexpected.length === 0
        ? 'columns are in the wrong order'
        : null,
    ]
      .filter(Boolean)
      .join('; ');
    return {
      rows,
      errors: [`Header mismatch — this is not a Darzi Register export (${detail}).`],
      headerValid: false,
      skipped: 0,
    };
  }

  for (const err of parsed.errors) {
    // Field-count problems mean the row is structurally broken; still try to
    // validate what parsed, but record the problem.
    errors.push(`row ${err.row + 2}: ${err.message}`);
  }

  const seenIds = new Set<string>();
  parsed.data.forEach((record, index) => {
    const lineNo = index + 2; // +1 for 0-based, +1 for the header row
    try {
      const customer = rowToCustomer(record, lineNo);
      if (seenIds.has(customer.id)) {
        errors.push(`row ${lineNo}: duplicate customer id "${customer.id}" — kept the first occurrence.`);
        return;
      }
      seenIds.add(customer.id);
      rows.push(customer);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      errors.push(detail);
    }
  });

  return {
    rows,
    errors,
    headerValid: true,
    skipped: parsed.data.length - rows.length,
  };
}

export interface FreshImportResult {
  imported: number;
  failed: number;
  errors: string[];
}

/**
 * Import parsed rows as BRAND-NEW customers — the file-picker flow the
 * user runs when moving an export onto a phone.
 *
 * Deliberately different rules from the id-preserving importCustomers()
 * below (which exists for backup/restore bookkeeping):
 * - FRESH ids: the CSV's ids are never trusted — the repository assigns
 *   a new id per row, so nothing can collide with existing records.
 * - photo_path is dropped: it points at the exporting device's files.
 * - No de-duplication: a row whose name+phone match an existing customer
 *   still imports (tailors legitimately keep repeat entries).
 * - createdAt/updatedAt are set by the repository (import time).
 *
 * Per-row failures are collected; they never abort the remaining rows.
 */
export async function importAsNewCustomers(
  rows: Customer[],
  repo: CustomerRepositoryLike,
): Promise<FreshImportResult> {
  const result: FreshImportResult = { imported: 0, failed: 0, errors: [] };
  for (const row of rows) {
    try {
      await repo.create({
        name: row.name,
        phone: row.phone,
        photoPath: null,
        measurements: row.measurements,
        stitchingOptions: row.stitchingOptions,
        notes: row.notes,
      });
      result.imported += 1;
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      result.failed += 1;
      result.errors.push(`customer "${row.name}": ${detail}`);
    }
  }
  return result;
}

/**
 * Insert parsed rows into the repository, one row at a time.
 * Per-row failures are collected; they never abort the remaining rows.
 */
export async function importCustomers(
  rows: Customer[],
  repo: CustomerRepositoryLike,
  strategy: ImportStrategy,
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, updated: 0, skipped: 0, failed: 0, errors: [] };

  for (const row of rows) {
    try {
      const existing = await repo.getById(row.id);
      if (existing) {
        if (strategy === 'add') {
          // Explicit policy: 'add' never overwrites.
          result.skipped += 1;
          continue;
        }
        // 'update' overwrites everything except the stable id and original
        // createdAt timestamp.
        const changes: Partial<Omit<Customer, 'id' | 'createdAt'>> = {
          name: row.name,
          phone: row.phone,
          photoPath: row.photoPath,
          measurements: row.measurements,
          stitchingOptions: row.stitchingOptions,
          notes: row.notes,
          updatedAt: row.updatedAt,
        };
        await repo.update(row.id, changes);
        result.updated += 1;
      } else {
        const { id, ...rest } = row;
        await repo.create({ ...rest, id });
        result.imported += 1;
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      result.failed += 1;
      result.errors.push(`customer "${row.id}": ${detail}`);
    }
  }

  return result;
}
