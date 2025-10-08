// Web Search Tool Plugin

import type { ToolPlugin } from '../../plugins/types'
import { WebSearchTool } from './index'
import type { SearchQuery } from './types'

export class WebSearchToolPlugin implements ToolPlugin {
  metadata = {
    id: 'web-search-tool',
    name: 'Web Search',
    version: '1.0.0',
    description: 'Search the web and retrieve relevant information using RAG (Retrieval-Augmented Generation)',
    author: 'OpenChat',
    type: 'tool' as const,
    appVersion: '1.0.0',
    enabled: true,
  }

  private searchTool: WebSearchTool

  constructor() {
    this.searchTool = new WebSearchTool({
      maxConcurrentRequests: 3,
      requestTimeout: 10000,
      maxResultsPerQuery: 5,
      chunkSize: 1000,
      chunkOverlap: 200,
      enableCache: true,
      cacheExpiry: 3600000, // 1 hour
    })
  }

  getTool() {
    return {
      name: 'web_search',
      description: 'Search the web for information. Returns relevant content and sources that can be used to answer questions.',
      parameters: {
        query: {
          type: 'string',
          description: 'The search query',
          required: true,
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return (default: 5)',
          required: false,
        },
        format: {
          type: 'string',
          enum: ['text', 'json'],
          description: 'Output format (default: text)',
          required: false,
        },
      },
    }
  }

  async execute(params: {
    query: string
    maxResults?: number
    format?: 'text' | 'json'
  }): Promise<string> {
    const { query, maxResults = 5, format = 'text' } = params

    if (!query || query.trim().length === 0) {
      return 'Error: Search query cannot be empty'
    }

    try {
      const searchQuery: SearchQuery = {
        query: query.trim(),
        maxResults,
      }

      const result = await this.searchTool.searchAndFormat(searchQuery, format)

      // Add metadata about the search
      const queueStatus = this.searchTool.getQueueStatus()
      const metadata = `\n\n---\n*Search completed. Active requests: ${queueStatus.active}, Queued: ${queueStatus.queued}*`

      return result + metadata
    } catch (error) {
      console.error('Web search execution error:', error)
      return `Error performing web search: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }

  onLoad() {
    console.log('Web Search Tool loaded')
    console.log('- Concurrent requests: 3')
    console.log('- Request timeout: 10s')
    console.log('- Cache enabled: 1 hour')
  }

  onEnable() {
    console.log('Web Search Tool enabled')
  }

  async onDisable() {
    console.log('Web Search Tool disabled')
    this.searchTool.clearCache()
  }

  async onUnload() {
    console.log('Web Search Tool unloaded')
    this.searchTool.clearCache()
    await this.searchTool.cleanup()
  }

  // Additional helper methods
  getCacheStats() {
    return this.searchTool.getCacheStats()
  }

  clearCache() {
    this.searchTool.clearCache()
  }
}
