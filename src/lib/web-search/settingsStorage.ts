/**
 * Settings Storage for Web Search
 * Handles persistence of web search settings to localStorage
 */

import type { WebSearchSettings } from '../../components/WebSearchSettings';
import { DEFAULT_WEB_SEARCH_SETTINGS } from '../../components/WebSearchSettings';

const STORAGE_KEY = 'web-search-settings';

/**
 * Load web search settings from localStorage
 */
export function loadWebSearchSettings(): WebSearchSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_WEB_SEARCH_SETTINGS;
    }

    const parsed = JSON.parse(stored);
    
    // Merge with defaults to ensure all fields exist
    return {
      ...DEFAULT_WEB_SEARCH_SETTINGS,
      ...parsed,
      ragConfig: {
        ...DEFAULT_WEB_SEARCH_SETTINGS.ragConfig,
        ...(parsed.ragConfig || {})
      }
    };
  } catch (error) {
    console.error('Failed to load web search settings:', error);
    return DEFAULT_WEB_SEARCH_SETTINGS;
  }
}

/**
 * Save web search settings to localStorage
 */
export function saveWebSearchSettings(settings: WebSearchSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save web search settings:', error);
  }
}

/**
 * Clear web search settings from localStorage
 */
export function clearWebSearchSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear web search settings:', error);
  }
}
