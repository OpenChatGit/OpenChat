// Web Search Tool - Main Entry Point

import { WebScraper } from './scraper'
import { RAGProcessor } from './rag'
import type { SearchQuery, RAGContext, WebSearchConfig } from './types'

export class WebSearchTool {
  private scraper: WebScraper
  private ragProcessor: RAGProcessor
  private cache: Map<string, { context: RAGContext; timestamp: number }>

  constructor(config: Partial<WebSearchConfig> = {}) {
    // Use fetch-based scraper (browser-compatible)
    console.log('Using fetch scraper (browser-compatible)')
    this.scraper = new WebScraper(config)
    
    this.ragProcessor = new RAGProcessor(
      config.chunkSize || 1000,
      config.chunkOverlap || 200
    )
    this.cache = new Map()
  }

  /**
   * Perform web search and return RAG context
   */
  async search(query: SearchQuery): Promise<RAGContext> {
    const cacheKey = this.getCacheKey(query)

    // Check cache
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < 3600000) {
      console.log('Returning cached result for:', query.query)
      return cached.context
    }

    try {
      console.log('Performing web search for:', query.query)

      // Step 1: Search for results
      const searchResults = await this.scraper.search(
        query.query,
        query.maxResults || 5
      )

      if (searchResults.length === 0) {
        return this.createEmptyContext(query.query)
      }

      console.log(`Found ${searchResults.length} search results`)

      // Step 2: Scrape content from top results
      const scrapedContent = await this.scraper.scrapeMultiple(searchResults, query.query)

      console.log(`Scraped ${scrapedContent.length} pages`)

      // Step 3: Process with RAG
      const context = await this.ragProcessor.processSearchResults(
        query.query,
        searchResults,
        scrapedContent
      )

      // Cache the result
      this.cache.set(cacheKey, {
        context,
        timestamp: Date.now(),
      })

      return context
    } catch (error) {
      console.error('Web search error:', error)
      return this.createEmptyContext(query.query)
    }
  }

  /**
   * Get formatted context for AI
   */
  async searchAndFormat(query: SearchQuery, format: 'text' | 'json' = 'text'): Promise<string> {
    const context = await this.search(query)

    if (format === 'json') {
      return this.ragProcessor.formatContextAsJSON(context)
    }

    return this.ragProcessor.formatContextForAI(context)
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Cleanup if needed in the future
    this.clearCache()
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }

  /**
   * Get scraper queue status
   */
  getQueueStatus() {
    return this.scraper.getQueueStatus()
  }

  /**
   * Create cache key from query
   */
  private getCacheKey(query: SearchQuery): string {
    return `${query.query}:${query.maxResults || 5}`
  }

  /**
   * Create empty context when search fails
   */
  private createEmptyContext(query: string): RAGContext {
    return {
      query,
      results: [],
      relevantChunks: [],
      summary: 'No results found or search failed.',
      sources: [],
    }
  }
}

// Export the main plugin class
export { WebSearchToolPlugin } from './plugin'

// Export types and classes
export * from './types'
export { WebScraper } from './scraper'
export { RAGProcessor } from './rag'
