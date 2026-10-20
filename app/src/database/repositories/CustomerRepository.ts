/**
 * Typed repository for Customer records.
 *
 * All SQL here is parameterized. Complex fields are serialized to JSON on
 * write and parsed on read (see `rowToCustomer`); corrupt JSON falls back to
 * `EMPTY_MEASUREMENTS` / `[]` instead of throwing.
 */
import type { DB, QueryResult, Scalar } from '@op-engineering/op-sqlite';
import {
  EMPTY_MEASUREMENTS,
  newCustomerId,
} from '../../types/customer';
import type {
  Customer,
  MeasurementKey,
  Measurements,
  NewCustomer,
  StitchingOptionKey,
} from '../../types/customer';
import { MEASUREMENT_KEYS, STITCHING_KEYS } from '../../core/constants/fields';

const TABLE = 'customers';

const COLUMNS = [
  'id',
  'name',
  'phone',
  'photo_path',
  'measurements',
  'stitching_options',
  'notes',
  'created_at',
  'updated_at',
].join(', ');

const STITCHING_KEY_SET: ReadonlySet<string> = new Set(STITCHING_KEYS);
const MEASUREMENT_KEY_SET: ReadonlySet<string> = new Set(MEASUREMENT_KEYS);

function nowIso(): string {
  return new Date().toISOString();
}

function scalarToString(value: Scalar | undefined): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function scalarToStringOrNull(value: Scalar | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === 'string' ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parses the measurements JSON column; falls back to EMPTY_MEASUREMENTS. */
export function parseMeasurements(raw: string): Measurements {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return { ...EMPTY_MEASUREMENTS };
    }
    const result = { ...EMPTY_MEASUREMENTS };
    for (const key of MEASUREMENT_KEY_SET) {
      const value = parsed[key];
      if (typeof value === 'string') {
        result[key as MeasurementKey] = value;
      }
    }
    return result;
  } catch {
    return { ...EMPTY_MEASUREMENTS };
  }
}

/** Parses the stitching_options JSON column; falls back to []. */
export function parseStitchingOptions(raw: string): StitchingOptionKey[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const options: StitchingOptionKey[] = [];
    for (const item of parsed) {
      if (typeof item === 'string' && STITCHING_KEY_SET.has(item)) {
        options.push(item as StitchingOptionKey);
      }
    }
    return options;
  } catch {
    return [];
  }
}

/**
 * Maps a raw database row to a Customer. Single place where rows become
 * domain objects — every repository read goes through here.
 */
export function rowToCustomer(row: Record<string, Scalar>): Customer {
  return {
    id: scalarToString(row['id']),
    name: scalarToString(row['name']),
    phone: scalarToString(row['phone']),
    photoPath: scalarToStringOrNull(row['photo_path']),
    measurements: parseMeasurements(scalarToString(row['measurements'])),
    stitchingOptions: parseStitchingOptions(
      scalarToString(row['stitching_options']),
    ),
    notes: scalarToString(row['notes']),
    createdAt: scalarToString(row['created_at']),
    updatedAt: scalarToString(row['updated_at']),
  };
}

function firstRow(result: QueryResult): Record<string, Scalar> | null {
  return result.rows.length > 0 ? result.rows[0] : null;
}

/** Escapes `%`, `_` and `\` for use inside a LIKE pattern. */
function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** SQL expression that strips common phone separators, leaving digits. */
const NORMALIZED_PHONE = `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', ''), '+', '')`;

export class CustomerRepository {
  private readonly db: DB;

  constructor(db: DB) {
    this.db = db;
  }

  /** Inserts a new customer, generating id and timestamps. */
  async create(data: NewCustomer): Promise<Customer> {
    const name = data.name.trim();
    const phone = data.phone.trim();
    if (name === '') {
      throw new Error('Customer name is required.');
    }
    if (phone === '') {
      throw new Error('Customer phone is required.');
    }

    const customer: Customer = {
      ...data,
      id: newCustomerId(),
      name,
      phone,
      notes: data.notes ?? '',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await this.db.execute(
      `INSERT INTO ${TABLE} (id, name, phone, photo_path, measurements, stitching_options, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customer.id,
        customer.name,
        customer.phone,
        customer.photoPath,
        JSON.stringify(customer.measurements),
        JSON.stringify(customer.stitchingOptions),
        customer.notes,
        customer.createdAt,
        customer.updatedAt,
      ],
    );
    return customer;
  }

  /** Finds a customer by id, or null when missing. */
  async getById(id: string): Promise<Customer | null> {
    const result = await this.db.execute(
      `SELECT ${COLUMNS} FROM ${TABLE} WHERE id = ?`,
      [id],
    );
    const row = firstRow(result);
    return row ? rowToCustomer(row) : null;
  }

  /** All customers ordered by name (case-insensitive). */
  async getAll(): Promise<Customer[]> {
    const result = await this.db.execute(
      `SELECT ${COLUMNS} FROM ${TABLE} ORDER BY name COLLATE NOCASE ASC, id ASC`,
    );
    return result.rows.map(rowToCustomer);
  }

  /**
   * Persists all fields of an existing customer and refreshes `updatedAt`.
   * Throws when no customer with that id exists.
   */
  async update(customer: Customer): Promise<Customer> {
    const updated: Customer = { ...customer, updatedAt: nowIso() };
    const result = await this.db.execute(
      `UPDATE ${TABLE}
       SET name = ?, phone = ?, photo_path = ?, measurements = ?, stitching_options = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      [
        updated.name,
        updated.phone,
        updated.photoPath,
        JSON.stringify(updated.measurements),
        JSON.stringify(updated.stitchingOptions),
        updated.notes,
        updated.updatedAt,
        updated.id,
      ],
    );
    if (result.rowsAffected === 0) {
      throw new Error(`Customer not found: ${updated.id}`);
    }
    return updated;
  }

  /** Deletes a customer by id. No-op when the id does not exist. */
  async delete(id: string): Promise<void> {
    await this.db.execute(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
  }

  /**
   * Searches by name (case-insensitive substring) OR by phone with all
   * non-digit characters stripped from both the stored value and the query.
   * Returns [] for a blank query.
   */
  async search(query: string): Promise<Customer[]> {
    const trimmed = query.trim();
    if (trimmed === '') {
      return [];
    }

    const namePattern = `%${escapeLike(trimmed)}%`;
    const digits = trimmed.replace(/\D/g, '');

    const conditions = [`LOWER(name) LIKE LOWER(?) ESCAPE '\\'`];
    const params: Scalar[] = [namePattern];
    if (digits !== '') {
      conditions.push(`${NORMALIZED_PHONE} LIKE ? ESCAPE '\\'`);
      params.push(`%${digits}%`);
    }

    const result = await this.db.execute(
      `SELECT ${COLUMNS} FROM ${TABLE}
       WHERE ${conditions.join(' OR ')}
       ORDER BY name COLLATE NOCASE ASC, id ASC`,
      params,
    );
    return result.rows.map(rowToCustomer);
  }

  /** Total number of customers. */
  async count(): Promise<number> {
    const result = await this.db.execute(
      `SELECT COUNT(*) AS total FROM ${TABLE}`,
    );
    const row = firstRow(result);
    const total = row ? row['total'] : 0;
    return typeof total === 'number' ? total : 0;
  }
}
