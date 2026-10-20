// CSV export of the customer register.
//
// One row per customer, columns in the fixed order below. Escaping (commas,
// quotes, newlines inside notes/names) is handled by papaparse. Output is
// UTF-8 with a BOM so Excel/Sheets open Urdu text correctly.

import Papa from 'papaparse';
import type { Customer } from '../../types/customer';
import { MEASUREMENT_KEYS, STITCHING_KEYS } from '../../core/constants/fields';

/** Exact column order of the export format — csvImport validates against this. */
export const CSV_COLUMNS = [
  'id',
  'name',
  'phone',
  ...MEASUREMENT_KEYS,
  ...STITCHING_KEYS,
  'notes',
  'photo_path',
  'created_at',
  'updated_at',
] as const;

export type CsvColumn = (typeof CSV_COLUMNS)[number];

/** Map a customer to one CSV row. Stitching options serialize as 1/0. */
export function customerToCsvRow(customer: Customer): Record<CsvColumn, string> {
  const row = {} as Record<CsvColumn, string>;
  row.id = customer.id;
  row.name = customer.name;
  row.phone = customer.phone;
  for (const key of MEASUREMENT_KEYS) {
    row[key] = customer.measurements[key] ?? '';
  }
  for (const key of STITCHING_KEYS) {
    row[key] = customer.stitchingOptions.includes(key) ? '1' : '0';
  }
  row.notes = customer.notes ?? '';
  row.photo_path = customer.photoPath ?? '';
  row.created_at = customer.createdAt;
  row.updated_at = customer.updatedAt;
  return row;
}

/** Serialize customers to a CSV string (UTF-8 + BOM). Pure — no I/O. */
export function exportCustomers(customers: Customer[]): string {
  const data = customers.map(customerToCsvRow);
  const csv = Papa.unparse(
    { fields: [...CSV_COLUMNS], data },
    { newline: '\r\n' },
  );
  return `${Papa.BYTE_ORDER_MARK}${csv}`;
}
