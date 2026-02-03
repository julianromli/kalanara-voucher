/**
 * Safe localStorage wrapper that handles SecurityError
 * when localStorage is unavailable (e.g., incognito mode with strict settings)
 */

// In-memory fallback when localStorage is unavailable
const memoryStorage = new Map<string, string>();

/**
 * Check if localStorage is available and accessible
 */
function isLocalStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  
  try {
    const testKey = "__storage_test__";
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

// Cache the result to avoid repeated checks
let storageAvailable: boolean | null = null;

function checkStorageAvailability(): boolean {
  if (storageAvailable === null) {
    storageAvailable = isLocalStorageAvailable();
  }
  return storageAvailable;
}

export const safeStorage = {
  getItem(key: string): string | null {
    if (checkStorageAvailability()) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return memoryStorage.get(key) ?? null;
      }
    }
    return memoryStorage.get(key) ?? null;
  },

  setItem(key: string, value: string): void {
    if (checkStorageAvailability()) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch {
        // Fall through to memory storage
      }
    }
    memoryStorage.set(key, value);
  },

  removeItem(key: string): void {
    if (checkStorageAvailability()) {
      try {
        window.localStorage.removeItem(key);
        return;
      } catch {
        // Fall through to memory storage
      }
    }
    memoryStorage.delete(key);
  },
};

/**
 * Custom storage adapter for Supabase that uses safe storage
 */
export const safeStorageAdapter = {
  getItem: (key: string) => safeStorage.getItem(key),
  setItem: (key: string, value: string) => safeStorage.setItem(key, value),
  removeItem: (key: string) => safeStorage.removeItem(key),
};
