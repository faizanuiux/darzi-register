/**
 * Database singleton for the Darzi Register app.
 *
 * `openDatabase()` returns the shared op-sqlite DB instance, running pending
 * migrations on first open. The database file lives in the platform-default
 * location under the name `darzi-register.db`.
 */
import { open } from '@op-engineering/op-sqlite';
import type { DB } from '@op-engineering/op-sqlite';
import { migrate } from './migrations/migrations';

/** SQLite file name for the app database. */
export const DATABASE_NAME = 'darzi-register.db';

let instance: DB | null = null;
let opening: Promise<DB> | null = null;

/**
 * Opens (or returns) the shared database instance. Migrations run exactly
 * once, on first open. Concurrent callers share the same in-flight promise.
 */
export async function openDatabase(): Promise<DB> {
  if (instance) {
    return instance;
  }
  if (!opening) {
    opening = (async (): Promise<DB> => {
      const db = open({ name: DATABASE_NAME });
      await migrate(db);
      instance = db;
      return db;
    })();
  }
  return opening;
}

/**
 * Closes the shared instance and resets the singleton, so the next
 * `openDatabase()` call re-opens (and re-migrates) from scratch.
 */
export function closeDatabase(): void {
  if (instance) {
    try {
      instance.close();
    } finally {
      instance = null;
      opening = null;
    }
  } else {
    opening = null;
  }
}
