// Web Search Tool Types

export interface SearchQuery {
  query: string
  maxResults?: number
  timeout?: number
}

export interface SearchResult {
  title: string
  url: string
  snippet: string
  content?: string
  timestamp: number
}

export interface ScrapedContent {
  url: string
  title: string
  content: string
  metadata: {
    scrapedAt: number
    contentLength: number
    language?: string
    relevanceScore?: number
  }
}

export interface RAGContext {
  query: string
  results: SearchResult[]
  relevantChunks: ContentChunk[]
  summary: string
  sources: string[]
}

export interface ContentChunk {
  content: string
  source: string
  relevance: number
  metadata: {
    position: number
    length: number
  }
}

export interface WebSearchConfig {
  maxConcurrentRequests: number
  requestTimeout: number
  maxResultsPerQuery: number
  chunkSize: number
  chunkOverlap: number
  enableCache: boolean
  cacheExpiry: number // in milliseconds
}
