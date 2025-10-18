/**
 * SearchEngineFactory - Manages multiple search engines with fallback
 * 
 * This module provides a factory for creating search engines and handles
 * fallback logic when one search engine fails.
 */

import { SearchEngine } from './searchEngine';
import type { SearchResult } from './types';

export interface ISearchEngine {
  search(query: string, maxResults?: number): Promise<SearchResult[]>;
  getRateLimitStatus(): any;
}

/**
 * SearchEngineFactory with automatic fallback
 */
export class SearchEngineFactory {
  private engines: ISearchEngine[];
  private currentEngineIndex: number = 0;

  constructor() {
    // Initialize available search engines
    this.engines = [
      new SearchEngine() // DuckDuckGo
      // Add more engines here as fallbacks
    ];
  }

  /**
   * Search with automatic fallback to alternative engines
   */
  async search(query: string, maxResults: number = 10): Promise<SearchResult[]> {
    let lastError: any = null;

    // Try each engine in order
    for (let i = 0; i < this.engines.length; i++) {
      const engineIndex = (this.currentEngineIndex + i) % this.engines.length;
      const engine = this.engines[engineIndex];

      try {
        console.log(`Trying search engine ${engineIndex + 1}/${this.engines.length}`);
        const results = await engine.search(query, maxResults);

        if (results.length > 0) {
          // Success! Update current engine for next time
          this.currentEngineIndex = engineIndex;
          return results;
        }

        console.warn(`Engine ${engineIndex + 1} returned 0 results, trying next...`);
      } catch (error) {
        console.error(`Engine ${engineIndex + 1} failed:`, error);
        lastError = error;
      }
    }

    // All engines failed or returned no results
    console.error('All search engines failed or returned no results');
    
    if (lastError) {
      throw lastError;
    }

    return [];
  }

  /**
   * Get rate limit status from current engine
   */
  getRateLimitStatus(): any {
    return this.engines[this.currentEngineIndex].getRateLimitStatus();
  }
}

// Export singleton instance
export const searchEngineFactory = new SearchEngineFactory();
