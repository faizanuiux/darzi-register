import type { Customer, NewCustomer } from '../../../types/customer';

/**
 * Data-access contract for customers.
 *
 * The real SQLite repository (src/database/repositories/CustomerRepository.ts,
 * built in parallel) implements these exact signatures. It is wired in
 * src/app/bootstrap/AppBootstrap.tsx via setCustomerDataSource(); UI code
 * must only ever talk to the interface through getCustomerDataSource().
 */
export interface CustomerDataSource {
  create(data: NewCustomer): Promise<Customer>;
  getById(id: string): Promise<Customer | null>;
  getAll(): Promise<Customer[]>;
  update(customer: Customer): Promise<Customer>;
  delete(id: string): Promise<void>;
  search(query: string): Promise<Customer[]>;
  count(): Promise<number>;
}

let dataSource: CustomerDataSource | null = null;

/** Called once at startup by AppBootstrap with the real repository. */
export function setCustomerDataSource(ds: CustomerDataSource): void {
  dataSource = ds;
}

export function hasCustomerDataSource(): boolean {
  return dataSource !== null;
}

/**
 * Runtime duck-type guard for CustomerDataSource.
 *
 * The database module is built in parallel, so AppBootstrap cannot rely on
 * the repository's static type — it validates the export shape at runtime
 * before wiring it in via setCustomerDataSource().
 */
export function isCustomerDataSourceLike(value: unknown): value is CustomerDataSource {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const methods = ['create', 'getById', 'getAll', 'update', 'delete', 'search', 'count'] as const;
  return methods.every(method => typeof record[method] === 'function');
}

/** @throws if no data source has been wired yet (programming error). */
export function getCustomerDataSource(): CustomerDataSource {
  if (!dataSource) {
    throw new Error(
      'CustomerDataSource is not initialized. Wire the repository in AppBootstrap.',
    );
  }
  return dataSource;
}
