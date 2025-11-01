/**
 * Core TypeScript types and interfaces for the Web Search System
 */

// ============================================================================
// Search Options and Configuration
// ============================================================================

export interface SearchOptions {
  maxResults?: number;
  timeout?: number;
  forceSearch?: boolean;
}

export interface RAGConfig {
  chunkSize: number;              // Characters per chunk (default: 1000)
  chunkOverlap: number;           // Overlap between chunks (default: 200)
  maxChunks: number;              // Max chunks in context (default: 10)
  relevanceThreshold: number;     // Min relevance score (default: 0.1)
  trustedDomains: string[];       // Preferred domains
  recencyWeight: number;          // Weight for recency (0-1)
  qualityWeight: number;          // Weight for quality (0-1)
}

// ============================================================================
// Search Results and Content
// ============================================================================

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  rank: number;
}

export interface ContentMetadata {
  publishedDate?: Date;
  author?: string;
  domain: string;
  wordCount: number;
}

export interface ScrapedContent {
  url: string;
  title: string;
  content: string;
  metadata: ContentMetadata;
}

export interface Source {
  url: string;
  title: string;
  domain: string;
  publishedDate?: Date;
}

// ============================================================================
// RAG Processing
// ============================================================================

export interface ChunkMetadata {
  wordCount: number;
  publishedDate?: Date;
  domain: string;
  isTrustedDomain: boolean;
}

export interface ContentChunk {
  content: string;
  source: string;
  relevanceScore: number;
  position: number;
  metadata: ChunkMetadata;
}

export interface ProcessedContext {
  query: string;
  chunks: ContentChunk[];
  totalChunks: number;
  selectedChunks: number;
}

// ============================================================================
// Search Context
// ============================================================================

export interface SearchContext {
  query: string;
  chunks: ContentChunk[];
  sources: Source[];
  summary: string;
  timestamp: number;
}

// ============================================================================
// Error Handling
// ============================================================================

export enum SearchErrorType {
  NETWORK_ERROR = 'network_error',
  TIMEOUT = 'timeout',
  RATE_LIMITED = 'rate_limited',
  PARSE_ERROR = 'parse_error',
  NO_RESULTS = 'no_results',
  SCRAPING_FAILED = 'scraping_failed'
}

export interface SearchError {
  type: SearchErrorType;
  message: string;
  url?: string;
  retryable: boolean;
}

// ============================================================================
// Cache Management
// ============================================================================

export interface CacheEntry {
  query: string;
  context: SearchContext;
  timestamp: number;
  ttl: number;
  hits: number;
}

export interface CacheStore {
  entries: Map<string, CacheEntry>;
  maxSize: number;
  currentSize: number;
}

// ============================================================================
// Statistics and Monitoring
// ============================================================================

export interface SearchStats {
  totalSearches: number;
  cacheHits: number;
  cacheMisses: number;
  averageSearchTime: number;
}

export interface RateLimitStatus {
  requestsRemaining: number;
  resetTime: Date;
  isLimited: boolean;
}

// ============================================================================
// Output Formatting
// ============================================================================

export type OutputFormat = 'verbose' | 'compact' | 'json';

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_RAG_CONFIG: RAGConfig = {
  chunkSize: 1000,
  chunkOverlap: 200,
  maxChunks: 10,
  relevanceThreshold: 0.1,
  trustedDomains: [
    'wikipedia.org',
    'github.com',
    'stackoverflow.com',
    'mozilla.org',
    'w3.org'
  ],
  recencyWeight: 0.25,
  qualityWeight: 0.2
};

export const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  maxResults: 5,
  timeout: 45000, // 45 seconds (increased for slow sites)
  forceSearch: false
};
