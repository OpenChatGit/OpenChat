/**
 * SearchEngine - DuckDuckGo HTML scraping implementation
 * 
 * This module implements web search functionality using DuckDuckGo's HTML interface.
 * Features:
 * - HTML scraping via Tauri backend (no CORS issues)
 * - Token bucket rate limiting (10 requests/minute)
 * - Automatic retry with exponential backoff
 */

import { invoke } from '@tauri-apps/api/core';
import { SearchResult, SearchErrorType, RateLimitStatus } from './types';

// User-Agent rotation is now handled by the Rust backend

// ============================================================================
// Rate Limiting (Token Bucket Algorithm)
// ============================================================================

class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per millisecond
  private lastRefill: number;

  constructor(maxRequestsPerMinute: number = 10) {
    this.maxTokens = maxRequestsPerMinute;
    this.tokens = maxRequestsPerMinute;
    this.refillRate = maxRequestsPerMinute / 60000; // per millisecond
    this.lastRefill = Date.now();
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refill(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Try to consume a token
   * @returns true if token was consumed, false if rate limited
   */
  tryConsume(): boolean {
    this.refill();
    
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    
    return false;
  }

  /**
   * Wait until a token is available
   */
  async waitForToken(): Promise<void> {
    this.refill();
    
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    
    // Calculate wait time
    const tokensNeeded = 1 - this.tokens;
    const waitTime = Math.ceil(tokensNeeded / this.refillRate);
    
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    // Try again after waiting
    this.refill();
    this.tokens -= 1;
  }

  /**
   * Get current rate limit status
   */
  getStatus(): RateLimitStatus {
    this.refill();
    
    const requestsRemaining = Math.floor(this.tokens);
    const isLimited = this.tokens < 1;
    
    // Calculate when next token will be available
    let resetTime = new Date();
    if (isLimited) {
      const tokensNeeded = 1 - this.tokens;
      const waitTime = Math.ceil(tokensNeeded / this.refillRate);
      resetTime = new Date(Date.now() + waitTime);
    }
    
    return {
      requestsRemaining,
      resetTime,
      isLimited
    };
  }
}

// ============================================================================
// SearchEngine Class
// ============================================================================

export class SearchEngine {
  private rateLimiter: RateLimiter;

  constructor(maxRequestsPerMinute: number = 10) {
    this.rateLimiter = new RateLimiter(maxRequestsPerMinute);
  }

  /**
   * Search DuckDuckGo and return results
   * Uses Tauri backend to avoid CORS issues
   * @param query Search query
   * @param maxResults Maximum number of results to return
   * @returns Array of search results
   */
  async search(query: string, maxResults: number = 10): Promise<SearchResult[]> {
    // Wait for rate limit token
    await this.rateLimiter.waitForToken();

    try {
      // Call Tauri backend to perform search (avoids CORS)
      const html = await invoke<string>('search_duckduckgo', { query });

      // Debug: Log HTML length and first 500 chars
      console.log(`Received HTML: ${html.length} characters`);
      console.log('HTML preview:', html.substring(0, 500));

      // Parse HTML and extract results
      const results = this.parseResults(html, maxResults);

      if (results.length === 0) {
        console.warn('No search results found for query:', query);
        console.warn('HTML structure might have changed. Consider using alternative search engines.');
      }

      return results;

    } catch (error) {
      console.error('Search error:', error);
      throw {
        type: SearchErrorType.NETWORK_ERROR,
        message: error instanceof Error ? error.message : 'Unknown search error',
        retryable: true
      };
    }
  }

  /**
   * Parse DuckDuckGo HTML response and extract search results
   * Tries multiple selectors to handle different HTML structures
   */
  private parseResults(html: string, maxResults: number): SearchResult[] {
    const results: SearchResult[] = [];
    
    try {
      // Create a DOM parser
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Try multiple selectors for result elements
      // DuckDuckGo HTML structure can vary
      let resultElements = doc.querySelectorAll('.result');
      
      // If no results with .result, try alternative selectors
      if (resultElements.length === 0) {
        resultElements = doc.querySelectorAll('.results_links, .web-result, [data-testid="result"]');
      }

      console.log(`Found ${resultElements.length} result elements in HTML`);

      let rank = 1;
      for (const element of Array.from(resultElements)) {
        if (results.length >= maxResults) break;

        try {
          // Try multiple selectors for the link element
          let linkElement = element.querySelector('.result__a');
          if (!linkElement) {
            linkElement = element.querySelector('a.result-link, a[href^="http"]');
          }
          if (!linkElement) {
            // Try to find any link in the result
            linkElement = element.querySelector('a[href]');
          }
          
          if (!linkElement) {
            console.warn('No link element found in result');
            continue;
          }

          const title = linkElement.textContent?.trim() || '';
          let url = linkElement.getAttribute('href') || '';

          // Skip if no URL or internal DuckDuckGo links
          if (!url || url.startsWith('//duckduckgo.com') || url.includes('duckduckgo.com/y.js')) {
            continue;
          }
          
          // Handle relative URLs
          if (url.startsWith('//')) {
            url = 'https:' + url;
          }

          // Extract snippet - try multiple selectors
          let snippetElement = element.querySelector('.result__snippet');
          if (!snippetElement) {
            snippetElement = element.querySelector('.result-snippet, .snippet, [class*="snippet"]');
          }
          const snippet = snippetElement?.textContent?.trim() || '';

          // Only add if we have at least a title and URL
          if (title && url) {
            results.push({
              title,
              url,
              snippet,
              rank: rank++
            });
            console.log(`Parsed result ${rank - 1}: ${title.substring(0, 50)}...`);
          }

        } catch (error) {
          console.warn('Error parsing individual result:', error);
          continue;
        }
      }

      console.log(`Successfully parsed ${results.length} results`);

    } catch (error) {
      console.error('Error parsing search results:', error);
      throw {
        type: SearchErrorType.PARSE_ERROR,
        message: 'Failed to parse search results',
        retryable: false
      };
    }

    return results;
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): RateLimitStatus {
    return this.rateLimiter.getStatus();
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const searchEngine = new SearchEngine();
