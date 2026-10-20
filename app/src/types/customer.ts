// Shared domain types — single source of truth for the Customer model.
// Database layer, repositories, services, and UI must all use these types.

export type MeasurementKey =
  | 'kameez_len'
  | 'bazu'
  | 'terah'
  | 'gala'
  | 'chati'
  | 'kamar'
  | 'gera'
  | 'salwar_len'
  | 'payencha';

export type Measurements = Record<MeasurementKey, string>;

export type StitchingOptionKey =
  | 'front_jeeb'
  | 'single_jeeb'
  | 'double_jeeb'
  | 'hip'
  | 'collar'
  | 'bain'
  | 'cuff'
  | 'plate';

export interface Customer {
  /** Stable UUID, primary key. Never changes after creation. */
  id: string;
  /** Full name — required. */
  name: string;
  /** Mobile number — required. Stored as entered; search normalizes. */
  phone: string;
  /** Relative path to photo in app-managed storage, or null. */
  photoPath: string | null;
  /** All nine measurements as text (fractions/units preserved). */
  measurements: Measurements;
  /** Selected stitching options as structured keys. */
  stitchingOptions: StitchingOptionKey[];
  /** Free-text notes. */
  notes: string;
  /** ISO 8601 timestamps. */
  createdAt: string;
  updatedAt: string;
}

export type NewCustomer = Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>;

export const EMPTY_MEASUREMENTS: Measurements = {
  kameez_len: '',
  bazu: '',
  terah: '',
  gala: '',
  chati: '',
  kamar: '',
  gera: '',
  salwar_len: '',
  payencha: '',
};

export function newCustomerId(): string {
  // RFC 4122 v4 UUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
