/**
 * SearchOrchestrator - Coordinates search, scraping, and caching
 * 
 * This module orchestrates the entire search workflow:
 * - Executes searches via SearchEngine
 * - Scrapes content via BackendScraper
 * - Manages caching with TTL and LRU eviction
 * - Tracks statistics and performance metrics
 * - Handles errors with retry logic and exponential backoff
 */

import { searchEngineFactory } from './searchEngineFactory';
import { BackendScraper } from './backendScraper';
import { SourceRegistry } from './sourceRegistry';
import type {
  SearchResult,
  ScrapedContent,
  SearchContext,
  CacheEntry,
  SearchStats,
  SearchErrorType,
  ContentMetadata
} from './types';

// ============================================================================
// Configuration
// ============================================================================

interface OrchestratorConfig {
  cacheTTL: number;           // Cache time-to-live in milliseconds
  maxCacheSize: number;       // Maximum number of cache entries
  maxCacheSizeBytes: number;  // Maximum cache size in bytes
  scrapingTimeout: number;    // Timeout for scraping operations
  maxConcurrentScrapes: number; // Max parallel scraping requests
  maxRetries: number;         // Max retry attempts for failed operations
  cacheCleanupInterval: number; // Interval for automatic cache cleanup (ms)
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  cacheTTL: 3600000,          // 1 hour
  maxCacheSize: 100,          // 100 entries
  maxCacheSizeBytes: 100 * 1024 * 1024, // 100 MB
  scrapingTimeout: 45000,     // 45 seconds (increased for slow sites like GitHub)
  maxConcurrentScrapes: 5,    // 5 parallel requests
  maxRetries: 3,              // 3 retry attempts
  cacheCleanupInterval: 300000 // 5 minutes
};

// ============================================================================
// SearchOrchestrator Class
// ============================================================================

export class SearchOrchestrator {
  private backendScraper: BackendScraper;
  private config: OrchestratorConfig;
  private sourceRegistry: SourceRegistry;
  
  // Cache management
  private cache: Map<string, CacheEntry>;
  private cacheAccessOrder: string[]; // For LRU eviction
  private currentCacheSize: number;   // Current cache size in bytes
  private cleanupTimer: ReturnType<typeof setTimeout> | null = null;
  
  // Statistics
  private stats: SearchStats;
  private searchTimes: number[]; // For calculating average
  private cacheEvictions: number = 0;
  private cacheExpiries: number = 0;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.backendScraper = new BackendScraper();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sourceRegistry = new SourceRegistry();
    
    // Initialize cache
    this.cache = new Map();
    this.cacheAccessOrder = [];
    this.currentCacheSize = 0;
    
    // Initialize statistics
    this.stats = {
      totalSearches: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageSearchTime: 0
    };
    this.searchTimes = [];
    
    // Start automatic cache cleanup
    this.startCacheCleanup();
  }

  /**
   * Start automatic cache cleanup timer
   */
  private startCacheCleanup(): void {
    // Don't start if already running
    if (this.cleanupTimer) {
      return;
    }
    
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.cacheCleanupInterval);
    
    console.log(`[SearchOrchestrator] Cache cleanup scheduled every ${this.config.cacheCleanupInterval / 1000}s`);
  }

  /**
   * Stop automatic cache cleanup timer
   */
  stopCacheCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      console.log('[SearchOrchestrator] Cache cleanup stopped');
    }
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }
    
    if (expiredKeys.length > 0) {
      console.log(`[SearchOrchestrator] Cleaning up ${expiredKeys.length} expired cache entries`);
      
      for (const key of expiredKeys) {
        this.removeFromCache(key);
        this.cacheExpiries++;
      }
    }
  }

  /**
   * Perform a complete search operation
   * @param query Search query
   * @param maxResults Maximum number of results to return
   * @returns Array of search results
   */
  async search(query: string, maxResults: number = 5): Promise<SearchResult[]> {
    const startTime = Date.now();
    
    try {
      // Clear SourceRegistry when starting new search
      this.sourceRegistry.clear();
      
      this.stats.totalSearches++;
      
      // Execute search with retry logic using factory (automatic fallback)
      const results = await this.executeWithRetry(
        () => searchEngineFactory.search(query, maxResults),
        'search'
      );
      
      // Track search time
      const searchTime = Date.now() - startTime;
      this.trackSearchTime(searchTime);
      
      return results;
      
    } catch (error) {
      console.error('Search failed after retries:', error);
      throw error;
    }
  }

  /**
   * Scrape content from multiple URLs in parallel
   * @param urls Array of URLs to scrape
   * @returns Array of scraped content (partial results on errors)
   */
  async scrapeContent(urls: string[]): Promise<ScrapedContent[]> {
    if (urls.length === 0) {
      return [];
    }

    try {
      // Scrape URLs with configured timeout and concurrency
      const results = await this.backendScraper.scrapeMultiple(urls, {
        timeout_ms: this.config.scrapingTimeout,
        max_retries: this.config.maxRetries,
        max_concurrent: this.config.maxConcurrentScrapes
      });

      // Extract successful results
      const successful = this.backendScraper.getSuccessful(results);
      const failed = this.backendScraper.getFailed(results);

      if (failed.length > 0) {
        console.warn(`Failed to scrape ${failed.length}/${urls.length} URLs`);
        failed.forEach((f, i) => {
          console.warn(`  - ${urls[i]}: ${f.error}`);
        });
      }

      // Convert metadata format
      const scrapedContent = successful.map(content => this.convertScrapedContent(content));

      // Register sources in SourceRegistry after scraping
      this.registerScrapedSources(scrapedContent);

      return scrapedContent;

    } catch (error) {
      console.error('Scraping failed:', error);
      return []; // Return empty array on complete failure
    }
  }

  /**
   * Convert backend scraper format to internal format
   */
  private convertScrapedContent(content: any): ScrapedContent {
    const metadata: ContentMetadata = {
      domain: content.metadata.domain,
      wordCount: content.metadata.word_count,
      publishedDate: content.metadata.published_date 
        ? new Date(content.metadata.published_date) 
        : undefined,
      author: content.metadata.author
    };

    return {
      url: content.url,
      title: content.title,
      content: content.content,
      metadata
    };
  }

  /**
   * Register scraped sources in the SourceRegistry
   * @param scrapedContent Array of scraped content to register
   */
  private registerScrapedSources(scrapedContent: ScrapedContent[]): void {
    for (const content of scrapedContent) {
      this.sourceRegistry.registerSource(
        content.url,
        content.title,
        content.metadata.domain,
        content.metadata.publishedDate
      );
    }
  }

  /**
   * Get cached search context
   * @param query Search query (cache key)
   * @returns Cached context or null if not found/expired
   */
  getCached(query: string): SearchContext | null {
    const normalizedQuery = this.normalizeQuery(query);
    const entry = this.cache.get(normalizedQuery);

    if (!entry) {
      this.stats.cacheMisses++;
      return null;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // Remove expired entry
      this.removeFromCache(normalizedQuery);
      this.stats.cacheMisses++;
      return null;
    }

    // Update access order for LRU
    this.updateAccessOrder(normalizedQuery);
    
    // Increment hit counter
    entry.hits++;
    this.stats.cacheHits++;

    return entry.context;
  }

  /**
   * Set cached search context
   * @param query Search query (cache key)
   * @param context Search context to cache
   */
  setCached(query: string, context: SearchContext): void {
    const normalizedQuery = this.normalizeQuery(query);
    
    // Calculate entry size (approximate)
    const entrySize = this.estimateSize(context);

    // Check if we need to evict entries
    while (
      (this.cache.size >= this.config.maxCacheSize ||
       this.currentCacheSize + entrySize > this.config.maxCacheSizeBytes) &&
      this.cache.size > 0
    ) {
      this.evictLRU();
    }

    // Create cache entry
    const entry: CacheEntry = {
      query: normalizedQuery,
      context,
      timestamp: Date.now(),
      ttl: this.config.cacheTTL,
      hits: 0
    };

    // Add to cache
    this.cache.set(normalizedQuery, entry);
    this.currentCacheSize += entrySize;
    this.updateAccessOrder(normalizedQuery);
  }

  /**
   * Clear all cached entries
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheAccessOrder = [];
    this.currentCacheSize = 0;
    console.log('[SearchOrchestrator] Cache cleared');
  }

  /**
   * Enforce cache size limits by evicting entries if needed
   * This is more aggressive than the normal LRU eviction
   */
  enforceCacheLimits(): void {
    const stats = this.getCacheStats();
    
    // Check if we're over the byte limit
    if (stats.sizeBytes > stats.maxSizeBytes) {
      const bytesToFree = stats.sizeBytes - (stats.maxSizeBytes * 0.8); // Free to 80% capacity
      let freedBytes = 0;
      
      console.log(`[SearchOrchestrator] Cache over size limit (${stats.sizeMB.toFixed(2)} MB), freeing ${(bytesToFree / (1024 * 1024)).toFixed(2)} MB`);
      
      while (freedBytes < bytesToFree && this.cacheAccessOrder.length > 0) {
        const lruQuery = this.cacheAccessOrder[0];
        const entry = this.cache.get(lruQuery);
        
        if (entry) {
          freedBytes += this.estimateSize(entry.context);
        }
        
        this.evictLRU();
      }
      
      console.log(`[SearchOrchestrator] Freed ${(freedBytes / (1024 * 1024)).toFixed(2)} MB`);
    }
    
    // Check if we're over the entry count limit
    while (this.cache.size > this.config.maxCacheSize) {
      this.evictLRU();
    }
  }

  /**
   * Get cache entries sorted by various criteria
   */
  getCacheEntries(sortBy: 'lru' | 'size' | 'hits' | 'age' = 'lru'): Array<{
    query: string;
    timestamp: number;
    hits: number;
    sizeBytes: number;
    age: number;
  }> {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([query, entry]) => ({
      query,
      timestamp: entry.timestamp,
      hits: entry.hits,
      sizeBytes: this.estimateSize(entry.context),
      age: now - entry.timestamp
    }));
    
    switch (sortBy) {
      case 'lru':
        // Sort by access order (LRU first)
        return entries.sort((a, b) => {
          const aIndex = this.cacheAccessOrder.indexOf(a.query);
          const bIndex = this.cacheAccessOrder.indexOf(b.query);
          return aIndex - bIndex;
        });
      
      case 'size':
        // Sort by size (largest first)
        return entries.sort((a, b) => b.sizeBytes - a.sizeBytes);
      
      case 'hits':
        // Sort by hits (most hits first)
        return entries.sort((a, b) => b.hits - a.hits);
      
      case 'age':
        // Sort by age (oldest first)
        return entries.sort((a, b) => b.age - a.age);
      
      default:
        return entries;
    }
  }

  /**
   * Get current statistics
   */
  getStats(): SearchStats {
    return { ...this.stats };
  }

  /**
   * Get detailed cache statistics
   */
  getCacheStats(): {
    entries: number;
    sizeBytes: number;
    sizeMB: number;
    maxEntries: number;
    maxSizeBytes: number;
    maxSizeMB: number;
    hitRate: number;
    evictions: number;
    expiries: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    const totalRequests = this.stats.cacheHits + this.stats.cacheMisses;
    const hitRate = totalRequests > 0 ? this.stats.cacheHits / totalRequests : 0;
    
    let oldestTimestamp: number | null = null;
    let newestTimestamp: number | null = null;
    
    for (const entry of this.cache.values()) {
      if (oldestTimestamp === null || entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
      if (newestTimestamp === null || entry.timestamp > newestTimestamp) {
        newestTimestamp = entry.timestamp;
      }
    }
    
    return {
      entries: this.cache.size,
      sizeBytes: this.currentCacheSize,
      sizeMB: this.currentCacheSize / (1024 * 1024),
      maxEntries: this.config.maxCacheSize,
      maxSizeBytes: this.config.maxCacheSizeBytes,
      maxSizeMB: this.config.maxCacheSizeBytes / (1024 * 1024),
      hitRate,
      evictions: this.cacheEvictions,
      expiries: this.cacheExpiries,
      oldestEntry: oldestTimestamp,
      newestEntry: newestTimestamp
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalSearches: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageSearchTime: 0
    };
    this.searchTimes = [];
    this.cacheEvictions = 0;
    this.cacheExpiries = 0;
  }

  /**
   * Get the SourceRegistry instance
   * @returns The SourceRegistry instance
   */
  getSourceRegistry(): SourceRegistry {
    return this.sourceRegistry;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Normalize query for cache key consistency
   */
  private normalizeQuery(query: string): string {
    return query.toLowerCase().trim();
  }

  /**
   * Update LRU access order
   */
  private updateAccessOrder(query: string): void {
    // Remove from current position
    const index = this.cacheAccessOrder.indexOf(query);
    if (index > -1) {
      this.cacheAccessOrder.splice(index, 1);
    }
    
    // Add to end (most recently used)
    this.cacheAccessOrder.push(query);
  }

  /**
   * Remove entry from cache
   */
  private removeFromCache(query: string): void {
    const entry = this.cache.get(query);
    if (entry) {
      const entrySize = this.estimateSize(entry.context);
      this.currentCacheSize -= entrySize;
      this.cache.delete(query);
      
      // Remove from access order
      const index = this.cacheAccessOrder.indexOf(query);
      if (index > -1) {
        this.cacheAccessOrder.splice(index, 1);
      }
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (this.cacheAccessOrder.length === 0) {
      return;
    }

    // Get least recently used entry (first in array)
    const lruQuery = this.cacheAccessOrder[0];
    this.removeFromCache(lruQuery);
    this.cacheEvictions++;
    
    console.log(`[SearchOrchestrator] Evicted LRU cache entry: ${lruQuery}`);
  }

  /**
   * Estimate size of cache entry in bytes
   */
  private estimateSize(context: SearchContext): number {
    // Rough estimation: JSON string length * 2 (for UTF-16)
    const jsonStr = JSON.stringify(context);
    return jsonStr.length * 2;
  }

  /**
   * Track search time for statistics
   */
  private trackSearchTime(time: number): void {
    this.searchTimes.push(time);
    
    // Keep only last 100 search times
    if (this.searchTimes.length > 100) {
      this.searchTimes.shift();
    }
    
    // Calculate average
    const sum = this.searchTimes.reduce((a, b) => a + b, 0);
    this.stats.averageSearchTime = sum / this.searchTimes.length;
  }

  /**
   * Execute operation with retry logic and exponential backoff
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = this.config.maxRetries
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeWithTimeout(
          operation(),
          this.config.scrapingTimeout,
          operationName
        );
      } catch (error: any) {
        lastError = error;
        
        // Check if error is retryable
        if (!this.isRetryable(error)) {
          throw error;
        }
        
        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }
        
        // Calculate backoff time: 2^attempt * 1000ms
        const backoffTime = Math.pow(2, attempt) * 1000;
        console.warn(
          `${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}), ` +
          `retrying in ${backoffTime}ms...`,
          error
        );
        
        await this.sleep(backoffTime);
      }
    }
    
    // All retries exhausted
    console.error(`${operationName} failed after ${maxRetries + 1} attempts`);
    throw lastError;
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operationName: string
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject({
          type: 'timeout' as SearchErrorType,
          message: `${operationName} timed out after ${timeoutMs}ms`,
          retryable: true
        });
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(error: any): boolean {
    if (error && typeof error === 'object') {
      // Check explicit retryable flag
      if ('retryable' in error) {
        return error.retryable === true;
      }
      
      // Check error type
      if ('type' in error) {
        const retryableTypes: SearchErrorType[] = [
          'network_error' as SearchErrorType,
          'timeout' as SearchErrorType,
          'rate_limited' as SearchErrorType
        ];
        return retryableTypes.includes(error.type);
      }
    }
    
    // Default: retry on network-like errors
    return true;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const searchOrchestrator = new SearchOrchestrator();
