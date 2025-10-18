import { invoke } from '@tauri-apps/api/core';

export interface ContentMetadata {
  published_date?: string;
  author?: string;
  domain: string;
  word_count: number;
}

export interface ScrapedContent {
  url: string;
  title: string;
  content: string;
  metadata: ContentMetadata;
}

export interface ScrapeResult {
  success: boolean;
  content?: ScrapedContent;
  error?: string;
}

export interface ScrapeOptions {
  timeout_ms?: number;
  max_retries?: number;
  max_concurrent?: number;
}

/**
 * Promise timeout wrapper that rejects after specified milliseconds
 * @param promise Promise to wrap
 * @param timeoutMs Timeout in milliseconds
 * @param timeoutError Error message for timeout
 * @returns Promise that rejects on timeout
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutError)), timeoutMs)
    ),
  ]);
}

/**
 * Backend scraper that uses Rust/Tauri for web scraping with headless_chrome
 * 
 * This class provides a TypeScript wrapper around the Rust backend scraping functionality.
 * It handles:
 * - Parallel scraping of multiple URLs with concurrency control
 * - Single URL scraping with retry mechanism
 * - Timeout handling at the TypeScript level
 * - Error handling and partial results
 * - Content extraction and metadata parsing
 * 
 * Requirements: 2.1, 2.2, 9.3, 10.2
 */
export class BackendScraper {
  private defaultTimeout: number = 30000; // 30 seconds
  private defaultMaxRetries: number = 3;
  private defaultMaxConcurrent: number = 5;

  /**
   * Scrape multiple URLs in parallel with timeout handling
   * 
   * This method invokes the Rust backend to scrape multiple URLs concurrently.
   * It implements:
   * - Concurrency limiting (default: 5 concurrent requests)
   * - Per-URL timeout handling
   * - Retry mechanism with exponential backoff
   * - Partial results on errors (successful URLs are returned even if some fail)
   * 
   * @param urls Array of URLs to scrape
   * @param options Scraping options (timeout_ms, max_retries, max_concurrent)
   * @returns Array of scrape results (partial results on errors)
   * 
   * Requirements: 2.1, 2.2, 9.3, 10.2
   */
  async scrapeMultiple(
    urls: string[],
    options: ScrapeOptions = {}
  ): Promise<ScrapeResult[]> {
    if (urls.length === 0) {
      return [];
    }

    const timeoutMs = options.timeout_ms || this.defaultTimeout;
    const maxRetries = options.max_retries || this.defaultMaxRetries;
    const maxConcurrent = options.max_concurrent || this.defaultMaxConcurrent;

    try {
      // Add extra time for the overall operation (backend timeout + buffer)
      const overallTimeout = timeoutMs * urls.length + 10000;

      const results = await withTimeout(
        invoke<ScrapeResult[]>('scrape_urls', {
          urls,
          timeoutMs,
          maxRetries,
          maxConcurrent,
        }),
        overallTimeout,
        `Scraping operation timed out after ${overallTimeout}ms`
      );

      return results;
    } catch (error) {
      console.error('Error scraping multiple URLs:', error);
      
      // Check if it's a timeout error
      const isTimeout = error instanceof Error && error.message.includes('timed out');
      const errorMessage = isTimeout
        ? `Scraping timed out after ${timeoutMs}ms per URL`
        : `Failed to invoke scrape_urls: ${error}`;

      // Return error results for all URLs
      return urls.map((url) => ({
        success: false,
        error: `${errorMessage} (URL: ${url})`,
      }));
    }
  }

  /**
   * Scrape a single URL with timeout handling
   * 
   * This method invokes the Rust backend to scrape a single URL.
   * It implements:
   * - Timeout handling at the TypeScript level
   * - Retry mechanism (handled by Rust backend)
   * - Detailed error messages
   * 
   * @param url URL to scrape
   * @param options Scraping options (timeout_ms, max_retries)
   * @returns Scrape result
   * 
   * Requirements: 2.1, 2.2, 9.3, 10.2
   */
  async scrapeSingle(
    url: string,
    options: ScrapeOptions = {}
  ): Promise<ScrapeResult> {
    const timeoutMs = options.timeout_ms || this.defaultTimeout;
    const maxRetries = options.max_retries || this.defaultMaxRetries;

    try {
      // Add buffer time for retries and processing
      const overallTimeout = timeoutMs + 5000;

      const result = await withTimeout(
        invoke<ScrapeResult>('scrape_url', {
          url,
          timeoutMs,
          maxRetries,
        }),
        overallTimeout,
        `Scraping timed out after ${overallTimeout}ms`
      );

      return result;
    } catch (error) {
      console.error(`Error scraping URL ${url}:`, error);
      
      // Check if it's a timeout error
      const isTimeout = error instanceof Error && error.message.includes('timed out');
      const errorMessage = isTimeout
        ? `Scraping timed out after ${timeoutMs}ms`
        : `Failed to invoke scrape_url: ${error}`;

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get only successful scrape results
   * 
   * Filters an array of scrape results to return only successful ones.
   * Useful for processing partial results when some URLs fail.
   * 
   * @param results Array of scrape results
   * @returns Array of successful scraped content
   */
  getSuccessful(results: ScrapeResult[]): ScrapedContent[] {
    return results
      .filter((r) => r.success && r.content)
      .map((r) => r.content!);
  }

  /**
   * Get only failed scrape results
   * 
   * Filters an array of scrape results to return only failed ones.
   * Useful for logging and debugging.
   * 
   * @param results Array of scrape results
   * @returns Array of error messages with URLs
   */
  getFailed(results: ScrapeResult[]): Array<{ error: string }> {
    return results
      .filter((r) => !r.success)
      .map((r) => ({ error: r.error || 'Unknown error' }));
  }

  /**
   * Get statistics about scrape results
   * 
   * @param results Array of scrape results
   * @returns Statistics object
   */
  getStats(results: ScrapeResult[]): {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
  } {
    const total = results.length;
    const successful = results.filter((r) => r.success).length;
    const failed = total - successful;
    const successRate = total > 0 ? (successful / total) * 100 : 0;

    return {
      total,
      successful,
      failed,
      successRate,
    };
  }

  /**
   * Scrape multiple URLs with partial results on timeout
   * 
   * This method attempts to scrape all URLs but returns partial results
   * if the overall operation times out. This is useful for ensuring
   * the user gets some results even if not all URLs can be scraped.
   * 
   * @param urls Array of URLs to scrape
   * @param options Scraping options
   * @returns Array of scrape results (may be partial)
   * 
   * Requirements: 9.3, 10.2
   */
  async scrapeMultipleWithPartialResults(
    urls: string[],
    options: ScrapeOptions = {}
  ): Promise<ScrapeResult[]> {
    if (urls.length === 0) {
      return [];
    }

    const timeoutMs = options.timeout_ms || this.defaultTimeout;
    const results: ScrapeResult[] = [];

    // Scrape URLs one by one with individual timeouts
    for (const url of urls) {
      try {
        const result = await this.scrapeSingle(url, {
          ...options,
          timeout_ms: timeoutMs,
        });
        results.push(result);
      } catch (error) {
        // Add failed result and continue
        results.push({
          success: false,
          error: `Failed to scrape ${url}: ${error}`,
        });
      }
    }

    return results;
  }
}
