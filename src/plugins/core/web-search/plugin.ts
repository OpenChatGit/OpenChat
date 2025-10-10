// Web Search Tool Plugin

import type { ToolPlugin } from '../../types'
import { WebSearchTool } from './index'
import type { SearchQuery } from './types'

export class WebSearchToolPlugin implements ToolPlugin {
  metadata = {
    id: 'web-search-tool',
    name: 'Web Search',
    version: '1.0.0',
    description: 'Search the web and retrieve relevant information using RAG (Retrieval-Augmented Generation)',
    author: 'OpenChat Team',
    type: 'tool' as const,
    appVersion: '1.0.0',
    enabled: true,
    core: true,
  }

  tools = [
    {
      type: 'function' as const,
      function: {
        name: 'web_search',
        description: 'Search the web for current, real-time information. Use this tool proactively whenever the user asks about current events, recent information, specific facts, statistics, products, companies, or anything that might have changed since your training data. Returns relevant content and sources with citations.',
        parameters: {
          type: 'object' as const,
          properties: {
            query: {
              type: 'string',
              description: 'The search query - be specific and include relevant keywords for best results',
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results to return (default: 5, recommended: 3-7)',
            },
            format: {
              type: 'string',
              description: 'Output format (default: text)',
              enum: ['text', 'json'],
            },
          },
          required: ['query'],
        },
      },
    },
  ]

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

  async executeTool(toolName: string, args: Record<string, any>): Promise<string> {
    if (toolName !== 'web_search') {
      throw new Error(`Unknown tool: ${toolName}`)
    }

    const { query, maxResults = 5, format = 'text' } = args

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
