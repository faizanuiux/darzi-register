// Database module entry point.
// Re-exports the singleton database opener and a shared CustomerRepository.

import { openDatabase } from './database';
import { CustomerRepository } from './repositories/CustomerRepository';

export { openDatabase, CustomerRepository };
export { DATABASE_NAME } from './database';

let repository: CustomerRepository | null = null;

/** Initialize the database (runs migrations). Call once at app startup. */
export async function initDatabase(): Promise<void> {
  await openDatabase();
}

/** Shared CustomerRepository instance (opens DB lazily on first use). */
export async function getCustomerRepository(): Promise<CustomerRepository> {
  if (!repository) {
    const db = await openDatabase();
    repository = new CustomerRepository(db);
  }
  return repository;
}

/** Synchronous accessor — throws if initDatabase() hasn't completed. For AppBootstrap wiring. */
export function getCustomerRepositorySync(): CustomerRepository {
  if (!repository) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return repository;
}

/** For AppBootstrap's dynamic-import wiring: pre-create the repository. */
export async function wireRepository(): Promise<CustomerRepository> {
  return getCustomerRepository();
}

// Default export shape for AppBootstrap's flexible import handling.
export default { initDatabase, getCustomerRepository };
