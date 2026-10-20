// Minimal dependency-injection contract for the customer repository.
//
// The real CustomerRepository lives at
// src/database/repositories/CustomerRepository.ts (built in parallel — do NOT
// import it from here). These are the assumed signatures; if the real file's
// signatures differ, adapt this interface (and the call sites) to match.
//
// - create: accepts NewCustomer; `id` is optional so imports/backups can
//   preserve original record IDs. When omitted, the repository generates one.
// - getAll: every customer, unsorted contract (ordering is the caller's job).
// - getById: the customer or null when missing.
// - update: partial update of a record; returns the updated record or null.
// - delete: OPTIONAL — only needed for "replace" restores. restoreBackup
//   throws a clear error if replace mode is requested without it.

import type { Customer, NewCustomer } from '../../types/customer';

export interface CustomerRepositoryLike {
  create(customer: NewCustomer & { id?: string }): Promise<Customer>;
  getAll(): Promise<Customer[]>;
  getById(id: string): Promise<Customer | null>;
  update(id: string, changes: Partial<Omit<Customer, 'id' | 'createdAt'>>): Promise<Customer | null>;
  delete?(id: string): Promise<void>;
}
