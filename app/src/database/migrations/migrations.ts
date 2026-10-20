/**
 * Migration framework for the Darzi Register database.
 *
 * Migrations are applied in ascending version order inside a single
 * transaction. The applied version is recorded in the `schema_meta` table
 * (`schema_version` key) so re-running `migrate()` is a safe no-op.
 */
import type { DB, QueryResult, Scalar } from '@op-engineering/op-sqlite';
import { SCHEMA_V1_STATEMENTS, SCHEMA_V2_STATEMENTS } from '../schema/schema';

export interface Migration {
  /** Monotonically increasing schema version produced by this migration. */
  version: number;
  /** SQL statements applied in order. Must be idempotent-safe within a tx. */
  up: string[];
}

/** Ordered list of all migrations. Append new migrations at the end. */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: SCHEMA_V1_STATEMENTS,
  },
  {
    version: 2,
    up: SCHEMA_V2_STATEMENTS,
  },
];

const VERSION_KEY = 'schema_version';

function parseVersion(result: QueryResult): number {
  const row = result.rows[0];
  if (!row) {
    return 0;
  }
  const raw: Scalar = row['value'];
  const parsed = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Current applied schema version (0 when no migration has ever run). */
export async function getSchemaVersion(db: DB): Promise<number> {
  // schema_meta itself may not exist yet on a brand-new database.
  await db.execute(
    'CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
  );
  const result = await db.execute(
    'SELECT value FROM schema_meta WHERE key = ?',
    [VERSION_KEY],
  );
  return parseVersion(result);
}

/**
 * Applies every pending migration in one transaction and records the new
 * version in `schema_meta`. Safe to call on every app start.
 */
export async function migrate(db: DB): Promise<void> {
  const current = await getSchemaVersion(db);
  const pending = MIGRATIONS.filter(m => m.version > current).sort(
    (a, b) => a.version - b.version,
  );

  if (pending.length === 0) {
    return;
  }

  await db.transaction(async tx => {
    for (const migration of pending) {
      for (const statement of migration.up) {
        await tx.execute(statement);
      }
      await tx.execute(
        'INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)',
        [VERSION_KEY, String(migration.version)],
      );
    }
  });
}

/** Highest version declared in MIGRATIONS — should equal SCHEMA_VERSION. */
export function latestMigrationVersion(): number {
  return MIGRATIONS.reduce((max, m) => Math.max(max, m.version), 0);
}
