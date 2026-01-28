/**
 * Session storage utility for Quick Convert pages.
 * Persists generated data across page revisits within the same browser session.
 */

// Storage keys for each Quick Convert page
export const STORAGE_KEYS = {
  REQUIREMENTS: 'qc_requirements_data',
  PRD: 'qc_prd_data',
  STORIES: 'qc_stories_data',
  MOCKUPS: 'qc_mockups_data',
};

/**
 * Save data to session storage
 * @param {string} key - Storage key from STORAGE_KEYS
 * @param {object} data - Data to store
 * @returns {boolean} - Success status
 */
export function saveToSession(key, data) {
  try {
    const payload = {
      data,
      savedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(key, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.error('Failed to save to session storage:', error);
    return false;
  }
}

/**
 * Load data from session storage
 * @param {string} key - Storage key from STORAGE_KEYS
 * @returns {object|null} - Stored data or null if not found
 */
export function loadFromSession(key) {
  try {
    const stored = sessionStorage.getItem(key);
    if (!stored) return null;

    const { data, savedAt } = JSON.parse(stored);
    return { data, savedAt };
  } catch (error) {
    console.error('Failed to load from session storage:', error);
    return null;
  }
}

/**
 * Clear data from session storage for a specific key
 * @param {string} key - Storage key from STORAGE_KEYS
 */
export function clearSession(key) {
  try {
    sessionStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to clear session storage:', error);
  }
}

/**
 * Clear all Quick Convert session data
 */
export function clearAllQcSessions() {
  Object.values(STORAGE_KEYS).forEach((key) => {
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to clear ${key}:`, error);
    }
  });
}

/**
 * Check if there's any unsaved Quick Convert data
 * @returns {boolean}
 */
export function hasUnsavedData(key) {
  const stored = loadFromSession(key);
  return stored !== null && stored.data !== null;
}

/**
 * Hook helper to manage session storage with state
 * This provides the data structure for use with useState in components
 */
export function createSessionManager(key) {
  return {
    key,
    save: (data) => saveToSession(key, data),
    load: () => loadFromSession(key),
    clear: () => clearSession(key),
    hasData: () => hasUnsavedData(key),
  };
}
