import { create } from 'zustand';
import type { Customer } from '../../../types/customer';
import { getCustomerDataSource } from '../services/customerDataSource';

interface CustomersState {
  customers: Customer[];
  searchQuery: string;
  /** True during the initial load. */
  loading: boolean;
  /** True during pull-to-refresh. */
  refreshing: boolean;
  error: string | null;
  /** Loads the full customer list from the repository. */
  load: () => Promise<void>;
  /** Pull-to-refresh variant of load(). */
  refresh: () => Promise<void>;
  /** Searches via the repository (empty query reloads everything). */
  search: (query: string) => Promise<void>;
  /** Deletes a customer and drops them from local state. */
  remove: (id: string) => Promise<void>;
  clearError: () => void;
}

function toErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong.';
}

export const useCustomers = create<CustomersState>()((set, get) => ({
  customers: [],
  searchQuery: '',
  loading: false,
  refreshing: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const customers = await getCustomerDataSource().getAll();
      set({ customers, loading: false });
    } catch (e) {
      set({ loading: false, error: toErrorMessage(e) });
    }
  },

  refresh: async () => {
    set({ refreshing: true, error: null });
    try {
      const ds = getCustomerDataSource();
      const { searchQuery } = get();
      const customers = searchQuery.trim()
        ? await ds.search(searchQuery.trim())
        : await ds.getAll();
      set({ customers, refreshing: false });
    } catch (e) {
      set({ refreshing: false, error: toErrorMessage(e) });
    }
  },

  search: async query => {
    set({ searchQuery: query, error: null });
    try {
      const ds = getCustomerDataSource();
      const customers = query.trim() ? await ds.search(query.trim()) : await ds.getAll();
      set({ customers });
    } catch (e) {
      set({ error: toErrorMessage(e) });
    }
  },

  remove: async id => {
    try {
      await getCustomerDataSource().delete(id);
      set(state => ({
        customers: state.customers.filter(c => c.id !== id),
        error: null,
      }));
    } catch (e) {
      set({ error: toErrorMessage(e) });
      throw e;
    }
  },

  clearError: () => set({ error: null }),
}));
