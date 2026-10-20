/**
 * SQLite schema for the Darzi Register app.
 *
 * All domain objects are stored in a single `customers` table. Complex fields
 * (measurements, stitching options) are serialized to JSON strings by the
 * repository layer; this module only declares the table shape.
 */

/** Current schema version. Bump when adding a migration in migrations.ts. */
export const SCHEMA_VERSION = 2;

/** Meta table that records the applied schema version. */
export const CREATE_SCHEMA_META_TABLE = `
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);`.trim();

/** Main customers table. */
export const CREATE_CUSTOMERS_TABLE = `
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  photo_path TEXT,
  measurements TEXT NOT NULL,
  stitching_options TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);`.trim();

export const CREATE_IDX_CUSTOMERS_NAME = `
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);`.trim();

export const CREATE_IDX_CUSTOMERS_PHONE = `
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);`.trim();

/** All statements that make up schema version 1, in apply order. */
export const SCHEMA_V1_STATEMENTS: string[] = [
  CREATE_SCHEMA_META_TABLE,
  CREATE_CUSTOMERS_TABLE,
  CREATE_IDX_CUSTOMERS_NAME,
  CREATE_IDX_CUSTOMERS_PHONE,
];

/**
 * Plain key-value settings table (schema version 2). Among other things it
 * backs the activation-storage fallback used when the platform secure
 * storage (Android Keystore) is unavailable on a device.
 */
export const CREATE_SETTINGS_TABLE = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);`.trim();

/** All statements that make up schema version 2, in apply order. */
export const SCHEMA_V2_STATEMENTS: string[] = [CREATE_SETTINGS_TABLE];
