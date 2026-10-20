// CSV export → import round-trip tests (pure logic, no native modules).

import { exportCustomers, CSV_COLUMNS } from '../../src/services/export/csvExport';
import { parseCsv, importCustomers } from '../../src/services/import/csvImport';
import type { CustomerRepositoryLike } from '../../src/services/import/repository';
import type { Customer, NewCustomer } from '../../src/types/customer';
import { EMPTY_MEASUREMENTS } from '../../src/types/customer';

function sampleCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cust-001',
    name: 'احمد خان "Bhai", Jr.\nSecond line',
    phone: '+92 300 1234567',
    photoPath: 'photos/cust-001.jpg',
    measurements: {
      ...EMPTY_MEASUREMENTS,
      kameez_len: '39½',
      bazu: '24',
      terah: '18',
      gala: '15½',
      chati: '40',
      kamar: '36',
      gera: '22',
      salwar_len: '38',
      payencha: '16',
    },
    stitchingOptions: ['front_jeeb', 'collar', 'plate'],
    notes: 'Urdu note: جلدی چاہیے\nWith "quotes" and, commas.',
    createdAt: '2026-10-18T10:00:00.000Z',
    updatedAt: '2026-10-19T09:30:00.000Z',
    ...overrides,
  };
}

/** Minimal in-memory stand-in for CustomerRepository (DI, as designed). */
class InMemoryRepo implements CustomerRepositoryLike {
  store = new Map<string, Customer>();

  async create(customer: NewCustomer & { id?: string }): Promise<Customer> {
    const id = customer.id ?? `gen-${this.store.size + 1}`;
    if (this.store.has(id)) {
      throw new Error(`duplicate id ${id}`);
    }
    const now = new Date().toISOString();
    const created: Customer = {
      ...customer,
      id,
      createdAt: customer.id ? (this.store.get(id)?.createdAt ?? now) : now,
      updatedAt: now,
    };
    this.store.set(id, created);
    return created;
  }

  async getAll(): Promise<Customer[]> {
    return [...this.store.values()];
  }

  async getById(id: string): Promise<Customer | null> {
    return this.store.get(id) ?? null;
  }

  async update(
    id: string,
    changes: Partial<Omit<Customer, 'id' | 'createdAt'>>,
  ): Promise<Customer | null> {
    const existing = this.store.get(id);
    if (!existing) {
      return null;
    }
    const updated: Customer = { ...existing, ...changes, id };
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

const EXPECTED_COLUMNS = [
  'id',
  'name',
  'phone',
  'kameez_len',
  'bazu',
  'terah',
  'gala',
  'chati',
  'kamar',
  'gera',
  'salwar_len',
  'payencha',
  'front_jeeb',
  'single_jeeb',
  'double_jeeb',
  'hip',
  'collar',
  'bain',
  'cuff',
  'plate',
  'notes',
  'photo_path',
  'created_at',
  'updated_at',
];

describe('csv export', () => {
  it('uses the exact column order', () => {
    expect([...CSV_COLUMNS]).toEqual(EXPECTED_COLUMNS);
  });

  it('emits one header + one line per customer with a UTF-8 BOM', () => {
    const csv = exportCustomers([sampleCustomer()]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.replace(/^\uFEFF/, '').split('\r\n');
    expect(lines[0]).toBe(EXPECTED_COLUMNS.join(','));
    expect(lines).toHaveLength(2);
  });
});

describe('csv round-trip', () => {
  it('export → parse → import(add) preserves every field, measurement and stitching option', async () => {
    const c1 = sampleCustomer();
    const c2 = sampleCustomer({
      id: 'cust-002',
      name: 'Bilal Ahmed',
      phone: '03001234567',
      photoPath: null,
      stitchingOptions: [],
      notes: '',
    });

    const csv = exportCustomers([c1, c2]);
    const parsed = parseCsv(csv);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(2);

    const repo = new InMemoryRepo();
    const result = await importCustomers(parsed.rows, repo, 'add');
    expect(result).toMatchObject({ imported: 2, updated: 0, skipped: 0, failed: 0 });

    for (const original of [c1, c2]) {
      const stored = await repo.getById(original.id);
      expect(stored).not.toBeNull();
      expect(stored?.id).toBe(original.id);
      expect(stored?.name).toBe(original.name);
      expect(stored?.phone).toBe(original.phone);
      expect(stored?.photoPath).toBe(original.photoPath);
      expect(stored?.notes).toBe(original.notes);
      expect(stored?.measurements).toEqual(original.measurements);
      expect(stored?.stitchingOptions).toEqual(original.stitchingOptions);
    }
  });

  it("'add' never overwrites an existing id; 'update' does", async () => {
    const repo = new InMemoryRepo();
    const original = sampleCustomer({ name: 'Original Name' });
    const { id, ...rest } = original;
    await repo.create({ ...rest, id });

    const changed = sampleCustomer({ name: 'Changed Name' });
    const csv = exportCustomers([changed]);

    const addResult = await importCustomers(parseCsv(csv).rows, repo, 'add');
    expect(addResult).toMatchObject({ imported: 0, skipped: 1 });
    expect((await repo.getById(id))?.name).toBe('Original Name');

    const updateResult = await importCustomers(parseCsv(csv).rows, repo, 'update');
    expect(updateResult).toMatchObject({ imported: 0, updated: 1 });
    expect((await repo.getById(id))?.name).toBe('Changed Name');
  });
});

describe('malformed csv', () => {
  it('empty input produces errors, not a crash', () => {
    const parsed = parseCsv('');
    expect(parsed.rows).toEqual([]);
    expect(parsed.errors.length).toBeGreaterThan(0);
  });

  it('wrong headers are rejected with a descriptive error', () => {
    const parsed = parseCsv('foo,bar\n1,2\n');
    expect(parsed.rows).toEqual([]);
    expect(parsed.errors.some(e => e.includes('Header mismatch'))).toBe(true);
  });

  it('missing required fields skip the row with an error', () => {
    const header = EXPECTED_COLUMNS.join(',');
    const badRow = ['x1', '', '0300', ...Array(21).fill('')].join(',');
    const parsed = parseCsv(`${header}\n${badRow}\n`);
    expect(parsed.rows).toEqual([]);
    expect(parsed.errors.some(e => e.includes('missing customer name'))).toBe(true);
  });

  it('invalid stitching values skip the row with an error', () => {
    const header = EXPECTED_COLUMNS.join(',');
    const row = [
      'x2',
      'Name',
      '0300',
      ...Array(9).fill(''),
      '2', // front_jeeb (col 13) must be 1 or 0
      ...Array(11).fill(''),
    ].join(',');
    const parsed = parseCsv(`${header}\n${row}\n`);
    expect(parsed.rows).toEqual([]);
    expect(parsed.errors.some(e => e.includes('front_jeeb'))).toBe(true);
  });

  it('duplicate ids in one file keep the first occurrence', () => {
    const header = EXPECTED_COLUMNS.join(',');
    const mk = (name: string) =>
      ['dup1', name, '0300', ...Array(9).fill(''), ...Array(8).fill('0'), 'note', '', '', ''].join(
        ',',
      );
    const parsed = parseCsv(`${header}\n${mk('First')}\n${mk('Second')}\n`);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].name).toBe('First');
    expect(parsed.errors.some(e => e.includes('duplicate customer id'))).toBe(true);
  });

  it('garbage that is not csv at all does not crash', () => {
    const parsed = parseCsv('not,a,valid\n{{{{file');
    expect(parsed.rows).toEqual([]);
    expect(parsed.errors.length).toBeGreaterThan(0);
  });
});
