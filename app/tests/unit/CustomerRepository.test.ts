/// <reference types="node" />
/**
 * Unit tests for the database layer (schema, migrations, CustomerRepository).
 *
 * Test database: op-sqlite's React Native entry binds to native modules at
 * import time, so it cannot load under jest. The `@op-engineering/op-sqlite`
 * module is therefore mapped to a small adapter (below) that implements the
 * same `DB` interface — `open`, `execute`, `transaction`, `close` — on top of
 * Node's built-in `node:sqlite` with a `:memory:` database. Every SQL
 * statement issued by the migrations and the repository executes against
 * genuine SQLite; only the native binding is substituted.
 */
jest.mock('@op-engineering/op-sqlite', () => {
  const nodeSqlite = require('node:sqlite') as typeof import('node:sqlite');

  // NOTE: no local type aliases inside the factory — babel-plugin-jest-hoist
  // rejects new bindings there, so union types are written out inline.

  function toInput(
    value: string | number | boolean | null | ArrayBuffer | ArrayBufferView,
  ): string | number | bigint | null | Buffer {
    if (value === null || typeof value === 'string' || typeof value === 'number') {
      return value;
    }
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    if (value instanceof ArrayBuffer) {
      return Buffer.from(value);
    }
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }

  function toScalar(
    value: null | number | bigint | string | Uint8Array,
  ): string | number | boolean | null | ArrayBuffer | ArrayBufferView {
    if (typeof value === 'bigint') {
      return Number(value);
    }
    if (value instanceof Uint8Array) {
      return new Uint8Array(value);
    }
    return value;
  }

  function createDb() {
    const sqlite = new nodeSqlite.DatabaseSync(':memory:');

    const runQuery = (
      query: string,
      params: Array<
        string | number | boolean | null | ArrayBuffer | ArrayBufferView
      > = [],
    ): {
      insertId?: number;
      rowsAffected: number;
      rows: Array<
        Record<string, string | number | boolean | null | ArrayBuffer | ArrayBufferView>
      >;
    } => {
      const args = params.map(toInput);
      const stmt = sqlite.prepare(query);
      if (/^\s*select\b/i.test(query)) {
        const rawRows = stmt.all(...args) as Array<
          Record<string, null | number | bigint | string | Uint8Array>
        >;
        const rows = rawRows.map(raw => {
          const row: Record<
            string,
            string | number | boolean | null | ArrayBuffer | ArrayBufferView
          > = {};
          for (const key of Object.keys(raw)) {
            row[key] = toScalar(raw[key]);
          }
          return row;
        });
        return { rowsAffected: 0, rows };
      }
      const info = stmt.run(...args);
      return {
        rowsAffected: Number(info.changes),
        insertId: Number(info.lastInsertRowid),
        rows: [],
      };
    };

    const tx = {
      execute: (
        query: string,
        params?: Array<string | number | boolean | null | ArrayBuffer | ArrayBufferView>,
      ) => Promise.resolve(runQuery(query, params ?? [])),
      commit: () => {
        sqlite.exec('COMMIT');
        return Promise.resolve({ rowsAffected: 0, rows: [] });
      },
      rollback: () => {
        sqlite.exec('ROLLBACK');
        return { rowsAffected: 0, rows: [] };
      },
    };

    return {
      execute: (
        query: string,
        params?: Array<string | number | boolean | null | ArrayBuffer | ArrayBufferView>,
      ) => Promise.resolve(runQuery(query, params ?? [])),
      transaction: async (
        fn: (t: typeof tx) => Promise<void>,
      ): Promise<void> => {
        sqlite.exec('BEGIN');
        try {
          await fn(tx);
          sqlite.exec('COMMIT');
        } catch (err) {
          try {
            sqlite.exec('ROLLBACK');
          } catch {
            // Nothing to roll back (e.g. already rolled back).
          }
          throw err;
        }
      },
      close: () => {
        sqlite.close();
      },
    };
  }

  return {
    open: () => createDb(),
  };
});

import { closeDatabase, openDatabase } from '../../src/database/database';
import {
  CustomerRepository,
  parseMeasurements,
  parseStitchingOptions,
} from '../../src/database/repositories/CustomerRepository';
import {
  getSchemaVersion,
  migrate,
} from '../../src/database/migrations/migrations';
import { SCHEMA_VERSION } from '../../src/database/schema/schema';
import { EMPTY_MEASUREMENTS } from '../../src/types/customer';
import type { Customer, NewCustomer } from '../../src/types/customer';
import type { DB } from '@op-engineering/op-sqlite';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function makeNewCustomer(overrides: Partial<NewCustomer> = {}): NewCustomer {
  return {
    name: 'Ahmed Khan',
    phone: '+92 345 1081073',
    photoPath: null,
    measurements: {
      ...EMPTY_MEASUREMENTS,
      kameez_len: '42',
      bazu: '24.5',
      chati: '38.5',
    },
    stitchingOptions: ['front_jeeb', 'collar'],
    notes: 'Regular customer',
    ...overrides,
  };
}

let db: DB;
let repo: CustomerRepository;

beforeEach(async () => {
  closeDatabase();
  db = await openDatabase();
  repo = new CustomerRepository(db);
});

afterAll(() => {
  closeDatabase();
});

describe('migrations', () => {
  test('run on first open and record the schema version', async () => {
    expect(await getSchemaVersion(db)).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(1);
  });

  test('openDatabase returns the same instance and migrate is idempotent', async () => {
    const created = await repo.create(makeNewCustomer());
    const again = await openDatabase();
    expect(again).toBe(db);
    await migrate(db);
    expect(await getSchemaVersion(db)).toBe(SCHEMA_VERSION);
    // Data survives a second migrate() call.
    expect(await repo.getById(created.id)).not.toBeNull();
  });
});

describe('create', () => {
  test('generates a UUID id and ISO timestamps', async () => {
    const customer = await repo.create(makeNewCustomer());
    expect(customer.id).toMatch(UUID_V4);
    expect(new Date(customer.createdAt).toISOString()).toBe(customer.createdAt);
    expect(new Date(customer.updatedAt).toISOString()).toBe(customer.updatedAt);
    expect(customer.name).toBe('Ahmed Khan');
    expect(customer.phone).toBe('+92 345 1081073');
    expect(customer.photoPath).toBeNull();
    expect(customer.notes).toBe('Regular customer');
  });

  test('trims name and phone and rejects blanks', async () => {
    const customer = await repo.create(
      makeNewCustomer({ name: '  Ahmed Khan  ', phone: '  0345  ' }),
    );
    expect(customer.name).toBe('Ahmed Khan');
    expect(customer.phone).toBe('0345');

    await expect(repo.create(makeNewCustomer({ name: '   ' }))).rejects.toThrow(
      'name is required',
    );
    await expect(
      repo.create(makeNewCustomer({ phone: '  ' })),
    ).rejects.toThrow('phone is required');
  });

  test('round-trips a non-null photo path', async () => {
    const created = await repo.create(
      makeNewCustomer({ photoPath: 'photos/abc-123.jpg' }),
    );
    const found = await repo.getById(created.id);
    expect(found?.photoPath).toBe('photos/abc-123.jpg');
  });
});

describe('getById', () => {
  test('returns the created customer', async () => {
    const created = await repo.create(makeNewCustomer());
    const found = await repo.getById(created.id);
    expect(found).toEqual(created);
  });

  test('returns null for an unknown id', async () => {
    expect(await repo.getById('no-such-id')).toBeNull();
  });
});

describe('update', () => {
  test('persists changes and refreshes updatedAt', async () => {
    const created = await repo.create(makeNewCustomer());
    const changed: Customer = {
      ...created,
      name: 'Ahmed Raza',
      measurements: { ...created.measurements, kamar: '36.25' },
      stitchingOptions: ['double_jeeb'],
    };
    const updated = await repo.update(changed);

    expect(updated.name).toBe('Ahmed Raza');
    expect(updated.measurements.kamar).toBe('36.25');
    expect(updated.stitchingOptions).toEqual(['double_jeeb']);
    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(
      new Date(updated.updatedAt).getTime() >=
        new Date(created.updatedAt).getTime(),
    ).toBe(true);

    const reloaded = await repo.getById(created.id);
    expect(reloaded).toEqual(updated);
  });

  test('throws for a missing customer', async () => {
    const ghost = await repo.create(makeNewCustomer());
    await expect(
      repo.update({ ...ghost, id: 'missing-id', name: 'Ghost' }),
    ).rejects.toThrow('not found');
  });
});

describe('delete', () => {
  test('removes the customer', async () => {
    const first = await repo.create(makeNewCustomer({ name: 'First' }));
    await repo.create(makeNewCustomer({ name: 'Second' }));

    await repo.delete(first.id);

    expect(await repo.getById(first.id)).toBeNull();
    expect(await repo.count()).toBe(1);
    expect((await repo.getAll()).map(c => c.name)).toEqual(['Second']);
  });

  test('is a no-op for an unknown id', async () => {
    await repo.create(makeNewCustomer());
    await expect(repo.delete('no-such-id')).resolves.toBeUndefined();
    expect(await repo.count()).toBe(1);
  });
});

describe('getAll', () => {
  test('orders by name case-insensitively', async () => {
    await repo.create(makeNewCustomer({ name: 'bilal', phone: '1' }));
    await repo.create(makeNewCustomer({ name: 'Ahmed', phone: '2' }));
    await repo.create(makeNewCustomer({ name: 'chand', phone: '3' }));

    expect((await repo.getAll()).map(c => c.name)).toEqual([
      'Ahmed',
      'bilal',
      'chand',
    ]);
  });
});

describe('search', () => {
  beforeEach(async () => {
    await repo.create(
      makeNewCustomer({ name: 'Ahmed Khan', phone: '+92 345-1081073' }),
    );
    await repo.create(
      makeNewCustomer({ name: 'Bilal Hussain', phone: '0345 9998877' }),
    );
    await repo.create(
      makeNewCustomer({ name: 'فیضان خان', phone: '0300-1234567' }),
    );
  });

  test('matches names case-insensitively, in Latin and Urdu script', async () => {
    expect((await repo.search('ahmed')).map(c => c.name)).toEqual([
      'Ahmed Khan',
    ]);
    expect((await repo.search('KHAN')).map(c => c.name)).toEqual(['Ahmed Khan']);
    expect((await repo.search('خان')).map(c => c.name)).toEqual(['فیضان خان']);
  });

  test('matches phones with separators stripped on both sides', async () => {
    // Stored '+92 345-1081073' matches a digits-only query.
    expect((await repo.search('923451081073')).map(c => c.name)).toEqual([
      'Ahmed Khan',
    ]);
    // Partial digit query with its own formatting also matches.
    expect((await repo.search('345-1081')).map(c => c.name)).toEqual([
      'Ahmed Khan',
    ]);
    expect((await repo.search('03001234567')).map(c => c.name)).toEqual([
      'فیضان خان',
    ]);
  });

  test('does not match on unrelated digits', async () => {
    expect(await repo.search('0000000')).toEqual([]);
  });

  test('matches Urdu names by substring', async () => {
    expect((await repo.search('فیضان')).map(c => c.name)).toEqual(['فیضان خان']);
  });

  test('treats LIKE wildcards literally', async () => {
    await repo.create(makeNewCustomer({ name: '100% Cotton', phone: '111' }));
    expect((await repo.search('100%')).map(c => c.name)).toEqual(['100% Cotton']);
    // A bare '%' is escaped too: it matches only the row that literally
    // contains '%', not every row in the table.
    expect((await repo.search('%')).map(c => c.name)).toEqual(['100% Cotton']);
  });

  test('returns [] for a blank query', async () => {
    expect(await repo.search('   ')).toEqual([]);
  });
});

describe('count', () => {
  test('starts at zero and tracks inserts/deletes', async () => {
    expect(await repo.count()).toBe(0);
    const created = await repo.create(makeNewCustomer());
    expect(await repo.count()).toBe(1);
    await repo.delete(created.id);
    expect(await repo.count()).toBe(0);
  });
});

describe('measurements round-trip', () => {
  test('preserves every measurement exactly, including fractions', async () => {
    const measurements = {
      kameez_len: '42',
      bazu: '24.5',
      terah: '18.25',
      gala: '16.5',
      chati: '38.5',
      kamar: '36.75',
      gera: '22',
      salwar_len: '40.5',
      payencha: '8.25',
    };
    const stitchingOptions = [
      'front_jeeb',
      'double_jeeb',
      'hip',
      'collar',
      'bain',
      'cuff',
      'plate',
    ] as const;

    const created = await repo.create(
      makeNewCustomer({
        measurements: { ...measurements },
        stitchingOptions: [...stitchingOptions],
      }),
    );

    const reloaded = await repo.getById(created.id);
    expect(reloaded).not.toBeNull();
    expect(reloaded?.measurements).toEqual(measurements);
    expect(reloaded?.stitchingOptions).toEqual([...stitchingOptions]);
    // Fractions survive as exact strings (never coerced to numbers).
    expect(reloaded?.measurements.chati).toBe('38.5');
    expect(typeof reloaded?.measurements.chati).toBe('string');
  });
});

describe('corrupt JSON handling', () => {
  test('falls back to EMPTY_MEASUREMENTS and [] instead of throwing', async () => {
    const id = 'corrupt-row';
    await db.execute(
      `INSERT INTO customers
         (id, name, phone, photo_path, measurements, stitching_options, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        'Broken Row',
        '123',
        null,
        'not-json{{{',
        '[broken',
        '',
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );

    const found = await repo.getById(id);
    expect(found).not.toBeNull();
    expect(found?.measurements).toEqual(EMPTY_MEASUREMENTS);
    expect(found?.stitchingOptions).toEqual([]);
  });

  test('parse helpers fall back on invalid input', () => {
    expect(parseMeasurements('garbage')).toEqual(EMPTY_MEASUREMENTS);
    expect(parseMeasurements('{"kameez_len": 42}')).toEqual(EMPTY_MEASUREMENTS);
    expect(parseStitchingOptions('garbage')).toEqual([]);
    expect(parseStitchingOptions('{"a":1}')).toEqual([]);
  });
});
