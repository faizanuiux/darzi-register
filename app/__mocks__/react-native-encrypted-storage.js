/**
 * Jest-only stand-in for react-native-encrypted-storage.
 *
 * The real library throws at import time when its native module is missing
 * (as in jest), so tests import this in-memory mock automatically. Explicit
 * jest.mock('react-native-encrypted-storage', () => ...) factories in
 * individual test files still take precedence over this file.
 */
const store = new Map();

module.exports = {
  __esModule: true,
  default: {
    setItem: jest.fn(async (key, value) => {
      store.set(key, String(value));
    }),
    getItem: jest.fn(async key => {
      const value = store.get(key);
      return value === undefined ? null : value;
    }),
    removeItem: jest.fn(async key => {
      store.delete(key);
    }),
    clear: jest.fn(async () => {
      store.clear();
    }),
    __clearStore: () => store.clear(),
  },
};
