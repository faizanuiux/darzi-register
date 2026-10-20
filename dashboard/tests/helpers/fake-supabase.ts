/**
 * In-memory fake of the Supabase JS query builder, shaped like the real
 * client surface the API routes use:
 *
 *   supabase.from(table).select(...).eq(...).single()/maybeSingle()
 *   supabase.from(table).insert(...).select()
 *   supabase.from(table).update(...).eq(...)
 *   supabase.from(table).upsert(..., { onConflict })
 *
 * The builder is thenable, so `await` works exactly like the real client.
 * It also simulates the constraints the migrations define:
 *  - `devices.device_id` UNIQUE
 *  - `licenses.device_id` partial UNIQUE (non-null device_ids)
 * violations surface as `{ code: "23505" }` errors, like Postgres.
 */

export type Row = Record<string, any>;

export interface FakeDatabase {
  licenses: Row[];
  devices: Row[];
  activation_events: Row[];
  admin_audit_logs: Row[];
  app_settings: Row[];
}

let idSeq = 0;
function nextId(table: string): string {
  idSeq += 1;
  return `fake-${table}-${idSeq}`;
}

type TableName = "licenses" | "devices" | "activation_events" | "admin_audit_logs" | "app_settings";

class FakeQueryBuilder {
  private op: "select" | "insert" | "update" | "upsert" | "delete" | null = null;
  private payload: any = null;
  private upsertOptions: { onConflict?: string } = {};
  private selectOptions: { count?: string; head?: boolean } = {};
  private filters: Array<(r: Row) => boolean> = [];
  private singleMode: "single" | "maybeSingle" | null = null;
  private orderBy: { col: string; ascending: boolean } | null = null;
  private limitN: number | null = null;

  constructor(
    private db: FakeDatabase,
    private table: TableName,
  ) {}

  select(_columns = "*", options: { count?: string; head?: boolean } = {}): this {
    if (!this.op) this.op = "select";
    this.selectOptions = options;
    return this;
  }
  insert(rows: any): this {
    this.op = "insert";
    this.payload = rows;
    return this;
  }
  update(values: any): this {
    this.op = "update";
    this.payload = values;
    return this;
  }
  upsert(rows: any, options: { onConflict?: string } = {}): this {
    this.op = "upsert";
    this.payload = rows;
    this.upsertOptions = options;
    return this;
  }
  delete(): this {
    this.op = "delete";
    return this;
  }
  eq(col: string, value: any): this {
    this.filters.push((r) => r[col] === value);
    return this;
  }
  is(col: string, value: any): this {
    this.filters.push((r) => r[col] === value);
    return this;
  }
  neq(col: string, value: any): this {
    this.filters.push((r) => r[col] !== value);
    return this;
  }
  single(): this {
    this.singleMode = "single";
    return this;
  }
  maybeSingle(): this {
    this.singleMode = "maybeSingle";
    return this;
  }
  order(col: string, opts: { ascending?: boolean } = {}): this {
    this.orderBy = { col, ascending: opts.ascending ?? true };
    return this;
  }
  limit(n: number): this {
    this.limitN = n;
    return this;
  }

  private rows(): Row[] {
    return this.db[this.table];
  }
  private matched(): Row[] {
    return this.rows().filter((r) => this.filters.every((f) => f(r)));
  }

  private applySingle(rows: Row[]): { data: any; error: any } {
    if (this.singleMode === "single") {
      if (rows.length !== 1) {
        return {
          data: null,
          error: { code: "PGRST116", message: `expected exactly 1 row, got ${rows.length}` },
        };
      }
      return { data: rows[0], error: null };
    }
    if (this.singleMode === "maybeSingle") {
      if (rows.length > 1) {
        return {
          data: null,
          error: { code: "PGRST116", message: `expected 0-1 rows, got ${rows.length}` },
        };
      }
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null };
  }

  private uniqueViolation(
    candidate: Row,
    ignore?: Row,
  ): { code: string; message: string } | null {
    if (this.table === "devices" && candidate.device_id != null) {
      const clash = this.db.devices.some((r) => r !== ignore && r.device_id === candidate.device_id);
      if (clash) {
        return { code: "23505", message: 'duplicate key value violates unique constraint "devices_device_id_key"' };
      }
    }
    if (this.table === "licenses" && candidate.device_id != null) {
      const clash = this.db.licenses.some((r) => r !== ignore && r.device_id === candidate.device_id);
      if (clash) {
        return { code: "23505", message: 'duplicate key value violates unique constraint "licenses_device_id_unique"' };
      }
    }
    return null;
  }

  private runSelect(): { data: any; error: any; count?: number } {
    let rows = this.matched();
    const totalCount = rows.length;
    if (this.orderBy) {
      const { col, ascending } = this.orderBy;
      rows = [...rows].sort((a, b) => {
        if (a[col] === b[col]) return 0;
        return (a[col] < b[col] ? -1 : 1) * (ascending ? 1 : -1);
      });
    }
    if (this.limitN != null) rows = rows.slice(0, this.limitN);
    const result = this.applySingle(rows);
    if (this.selectOptions.count === "exact") {
      return { ...result, count: totalCount };
    }
    return result;
  }

  private runInsert(): { data: any; error: any } {
    const inputs = Array.isArray(this.payload) ? this.payload : [this.payload];
    const inserted: Row[] = [];
    for (const input of inputs) {
      const violation = this.uniqueViolation(input);
      if (violation) return { data: null, error: violation };
      const row: Row = { id: nextId(this.table), created_at: new Date().toISOString(), ...input };
      this.rows().push(row);
      inserted.push(row);
    }
    return this.applySingle(inserted);
  }

  private runUpdate(): { data: any; error: any } {
    const rows = this.matched();
    for (const row of rows) {
      const violation = this.uniqueViolation({ ...row, ...this.payload }, row);
      if (violation) return { data: null, error: violation };
    }
    for (const row of rows) Object.assign(row, this.payload);
    return this.applySingle(rows);
  }

  private runUpsert(): { data: any; error: any } {
    const inputs = Array.isArray(this.payload) ? this.payload : [this.payload];
    const conflictCol = this.upsertOptions.onConflict;
    const out: Row[] = [];
    for (const input of inputs) {
      const existing = conflictCol
        ? this.rows().find((r) => r[conflictCol] === input[conflictCol])
        : undefined;
      if (existing) {
        const violation = this.uniqueViolation({ ...existing, ...input }, existing);
        if (violation) return { data: null, error: violation };
        Object.assign(existing, input);
        out.push(existing);
      } else {
        const violation = this.uniqueViolation(input);
        if (violation) return { data: null, error: violation };
        const row: Row = { id: nextId(this.table), created_at: new Date().toISOString(), ...input };
        this.rows().push(row);
        out.push(row);
      }
    }
    return this.applySingle(out);
  }

  private runDelete(): { data: any; error: any } {
    const rows = this.matched();
    const table = this.rows();
    for (const row of rows) {
      const idx = table.indexOf(row);
      if (idx >= 0) table.splice(idx, 1);
    }
    return this.applySingle(rows);
  }

  private execute(): { data: any; error: any; count?: number } {
    switch (this.op) {
      case "insert":
        return this.runInsert();
      case "update":
        return this.runUpdate();
      case "upsert":
        return this.runUpsert();
      case "delete":
        return this.runDelete();
      case "select":
      default:
        return this.runSelect();
    }
  }

  /** Thenable — `await` works like the real Supabase client. */
  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

export interface FakeSupabaseClient {
  from(table: TableName): FakeQueryBuilder;
  /** Direct access to the in-memory store for assertions. */
  __db: FakeDatabase;
}

export function createFakeSupabase(seed?: Partial<FakeDatabase>): FakeSupabaseClient {
  const db: FakeDatabase = {
    licenses: [],
    devices: [],
    activation_events: [],
    admin_audit_logs: [],
    app_settings: [],
  };
  if (seed?.licenses) db.licenses.push(...seed.licenses);
  if (seed?.devices) db.devices.push(...seed.devices);
  if (seed?.activation_events) db.activation_events.push(...seed.activation_events);
  if (seed?.admin_audit_logs) db.admin_audit_logs.push(...seed.admin_audit_logs);
  if (seed?.app_settings) db.app_settings.push(...seed.app_settings);
  return {
    from: (table: TableName) => new FakeQueryBuilder(db, table),
    __db: db,
  };
}
