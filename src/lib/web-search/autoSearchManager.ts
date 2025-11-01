/**
 * AutoSearchManager - Automatically detects when web search is needed and executes it
 * 
 * This module handles:
 * - Query analysis to determine if search is helpful
 * - Search query extraction and optimization
 * - Full search pipeline execution
 * - Context injection into user messages
 */

import { searchOrchestrator } from './searchOrchestrator';
import type { SearchOrchestrator } from './searchOrchestrator';
import { loadRAGProcessor, loadContextFormatter } from './lazyLoader';
import type { RAGProcessor } from './ragProcessor';
import type { ContextFormatter } from './contextFormatter';
import type {
  SearchOptions,
  SearchContext,
  OutputFormat,
  ContentChunk,
  Source
} from './types';
import type { Message } from '../../types';
import { SearchEventEmitter, createSearchEvent } from './searchEvents';
import type {
  SearchEventListener,
  SearchEventType,
  SearchStartedEvent,
  SearchResultsFoundEvent,
  ScrapingStartedEvent,
  ScrapingCompletedEvent,
  ProcessingStartedEvent,
  ProcessingCompletedEvent,
  SearchCompletedEvent,
  SearchErrorEvent
} from './searchEvents';

// ============================================================================
// Configuration
// ============================================================================

interface AutoSearchConfig {
  enabled: boolean;
  maxResults: number;
  timeout: number;
  outputFormat: OutputFormat;
  maxContextLength: number;
}

const DEFAULT_CONFIG: AutoSearchConfig = {
  enabled: false, // Opt-in
  maxResults: 5,
  timeout: 30000, // 30 seconds
  outputFormat: 'verbose',
  maxContextLength: 8000 // characters
};

// ============================================================================
// Query Analysis Patterns
// ============================================================================

// German question words
const GERMAN_QUESTION_WORDS = [
  'wer', 'was', 'wann', 'wo', 'wie', 'warum', 'weshalb', 'wieso',
  'welche', 'welcher', 'welches', 'woher', 'wohin', 'womit'
];

// English question words
const ENGLISH_QUESTION_WORDS = [
  'who', 'what', 'when', 'where', 'why', 'how', 'which', 'whose'
];

// Time-related keywords (German and English)
const TIME_KEYWORDS = [
  // German
  'heute', 'aktuell', 'neueste', 'jetzt', 'momentan', 'derzeit',
  'kürzlich', 'letzte', 'aktuelle', 'neuste', 'gegenwärtig',
  // English
  'today', 'current', 'latest', 'now', 'recent', 'currently',
  'this year', 'this month', 'this week'
];

// Information request keywords (German and English)
const INFO_REQUEST_KEYWORDS = [
  // German
  'erkläre', 'erklär', 'zeige', 'zeig', 'finde', 'such', 'suche',
  'gib mir', 'liste', 'nenne', 'beschreibe', 'was ist', 'was sind',
  'informiere', 'berichte', 'erzähle',
  // English
  'explain', 'show', 'find', 'search', 'give me', 'list', 'tell me',
  'describe', 'what is', 'what are', 'inform', 'report'
];

// Year patterns (2020-2030)
const YEAR_PATTERN = /\b(202[0-9]|2030)\b/;

// German stopwords for query extraction
const GERMAN_STOPWORDS = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer',
  'eines', 'einem', 'einen', 'und', 'oder', 'aber', 'wenn', 'als',
  'wie', 'bei', 'nach', 'von', 'zu', 'mit', 'für', 'auf', 'an',
  'in', 'über', 'unter', 'durch', 'vor', 'hinter', 'neben', 'zwischen',
  'ist', 'sind', 'war', 'waren', 'sein', 'haben', 'hat', 'hatte',
  'werden', 'wird', 'wurde', 'können', 'kann', 'konnte', 'müssen',
  'muss', 'musste', 'sollen', 'soll', 'sollte', 'wollen', 'will',
  'wollte', 'dürfen', 'darf', 'durfte', 'mögen', 'mag', 'mochte',
  'mir', 'mich', 'dir', 'dich', 'sich', 'uns', 'euch', 'ihnen',
  'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr'
]);

// English stopwords for query extraction
const ENGLISH_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'as', 'at', 'by',
  'for', 'from', 'in', 'into', 'of', 'on', 'to', 'with', 'about',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
  'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could',
  'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her',
  'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their'
]);

// ============================================================================
// AutoSearchManager Class
// ============================================================================

export class AutoSearchManager {
  private orchestrator: SearchOrchestrator;
  private ragProcessor: RAGProcessor | null = null;
  private formatter: ContextFormatter | null = null;
  private config: AutoSearchConfig;
  private eventEmitter: SearchEventEmitter;

  constructor(config: Partial<AutoSearchConfig> = {}) {
    // Use singleton SearchOrchestrator to avoid multiple cleanup timers
    this.orchestrator = searchOrchestrator;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.eventEmitter = new SearchEventEmitter();
  }

  /**
   * Get or load RAGProcessor instance
   */
  private async getRAGProcessor(): Promise<RAGProcessor> {
    if (!this.ragProcessor) {
      this.ragProcessor = await loadRAGProcessor();
    }
    return this.ragProcessor;
  }

  /**
   * Get or load ContextFormatter instance
   */
  private async getFormatter(): Promise<ContextFormatter> {
    if (!this.formatter) {
      this.formatter = await loadContextFormatter();
    }
    return this.formatter;
  }

  /**
   * Subscribe to search events
   */
  on(eventType: SearchEventType, listener: SearchEventListener): () => void {
    return this.eventEmitter.on(eventType, listener);
  }

  /**
   * Subscribe to all search events
   */
  onAny(listener: SearchEventListener): () => void {
    return this.eventEmitter.onAny(listener);
  }

  /**
   * Unsubscribe from search events
   */
  off(eventType: SearchEventType, listener: SearchEventListener): void {
    this.eventEmitter.off(eventType, listener);
  }

  /**
   * Get event emitter for advanced usage
   */
  getEventEmitter(): SearchEventEmitter {
    return this.eventEmitter;
  }

  /**
   * Cleanup resources (stop timers, clear listeners)
   * Call this when the manager is no longer needed
   */
  cleanup(): void {
    this.eventEmitter.removeAllListeners();
    // Note: We don't stop the orchestrator's cleanup timer since it's shared
    // The singleton orchestrator will continue running for other instances
  }

  /**
   * Get the shared SearchOrchestrator instance
   * Useful for accessing cache statistics or stopping cleanup
   */
  getOrchestrator(): SearchOrchestrator {
    return this.orchestrator;
  }

  /**
   * Analyze query to determine if web search would be helpful
   * Uses heuristics to detect information-seeking queries
   */
  async shouldSearch(query: string, conversationHistory: Message[] = []): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    const normalizedQuery = query.toLowerCase().trim();

    // Skip empty queries
    if (normalizedQuery.length === 0) {
      return false;
    }

    // Check if this is a follow-up question (short query after recent messages)
    if (this.isFollowUpQuestion(query, conversationHistory)) {
      return false;
    }

    // Heuristic 1: Check for question words
    const hasQuestionWord = this.hasQuestionWords(normalizedQuery);

    // Heuristic 2: Check for time-related keywords
    const hasTimeReference = this.hasTimeReference(normalizedQuery);

    // Heuristic 3: Check for information request keywords
    const hasInfoRequest = this.hasInfoRequest(normalizedQuery);

    // Heuristic 4: Check for year mentions
    const hasYearMention = YEAR_PATTERN.test(normalizedQuery);

    // Heuristic 5: Check for question mark
    const hasQuestionMark = query.includes('?');

    // Filter out casual greetings and small talk
    const casualPatterns = [
      /^(hello|hi|hey|hallo|guten tag|grüß)/i,
      /^(how are you|wie geht|wie gehts)/i,
      /^(thank|danke|thanks)/i,
      /^(bye|tschüss|auf wiedersehen)/i
    ];

    if (casualPatterns.some(pattern => pattern.test(query))) {
      return false;
    }

    // Decision logic: Search if multiple indicators are present
    const indicators = [
      hasQuestionWord,
      hasTimeReference,
      hasInfoRequest,
      hasYearMention,
      hasQuestionMark
    ];

    const indicatorCount = indicators.filter(Boolean).length;

    // Strong indicators that alone justify a search
    if (hasTimeReference || hasYearMention) {
      return true;
    }

    // Info request alone is strong enough for substantial queries
    if (hasInfoRequest && query.length > 20) {
      return true;
    }

    // Info request + question word/mark is strong enough
    if (hasInfoRequest && (hasQuestionWord || hasQuestionMark)) {
      return true;
    }

    // Require at least 2 indicators otherwise
    if (indicatorCount >= 2) {
      return true;
    }

    // Additional check: if query is substantial (>30 chars) and has question word
    if (query.length > 30 && hasQuestionWord) {
      return true;
    }

    return false;
  }

  /**
   * Extract optimized search query from user input
   * Removes stopwords and extracts key terms
   * Adds recency keywords for version/release queries
   */
  extractSearchQuery(query: string): string {
    const normalizedQuery = query.toLowerCase().trim();

    // Remove question marks and other punctuation
    let cleaned = normalizedQuery.replace(/[?!.,;:]/g, ' ');

    // Split into words
    const words = cleaned.split(/\s+/).filter(w => w.length > 0);

    // Combine stopwords from both languages
    const stopwords = new Set([...GERMAN_STOPWORDS, ...ENGLISH_STOPWORDS]);

    // Filter out stopwords but keep important context words
    const importantWords: string[] = [];
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      
      // Always keep:
      // - Words longer than 3 characters
      // - Years (4 digits)
      // - Time-related keywords
      // - Capitalized words (likely proper nouns)
      const isYear = /^\d{4}$/.test(word);
      const isTimeKeyword = TIME_KEYWORDS.some(kw => kw.toLowerCase() === word);
      const isLongWord = word.length > 3;
      const isCapitalized = query.split(/\s+/)[i]?.[0] === query.split(/\s+/)[i]?.[0]?.toUpperCase();
      
      if (isYear || isTimeKeyword || isCapitalized) {
        importantWords.push(word);
      } else if (isLongWord && !stopwords.has(word)) {
        importantWords.push(word);
      } else if (!stopwords.has(word) && word.length > 2) {
        // Keep shorter words if they're not stopwords
        importantWords.push(word);
      }
    }

    // If we filtered too aggressively, fall back to original query
    if (importantWords.length === 0) {
      return query.trim();
    }

    // Get current date information
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.toLocaleDateString('en-US', { month: 'long' });
    
    // Detect if query already has a year
    const hasYearInQuery = importantWords.some(w => /^\d{4}$/.test(w));
    
    // Detect version/release/current information queries
    const versionKeywords = ['version', 'release', 'latest', 'current', 'newest', 'aktuell', 'neueste', 'update'];
    const hasVersionKeyword = versionKeywords.some(kw => 
      importantWords.some(word => word.includes(kw))
    );
    
    // Detect time-sensitive queries (news, events, etc.)
    const timeSensitiveKeywords = ['news', 'today', 'recent', 'now', 'currently', 'heute', 'aktuell', 'jetzt'];
    const isTimeSensitive = timeSensitiveKeywords.some(kw =>
      importantWords.some(word => word.includes(kw))
    );
    
    // Add temporal context to improve search results
    if (!hasYearInQuery) {
      if (hasVersionKeyword) {
        // For version queries, add year and month for maximum recency
        importantWords.push(currentYear.toString());
        importantWords.push(currentMonth);
        console.log(`[AutoSearch] Added temporal context for version query: ${currentYear} ${currentMonth}`);
      } else if (isTimeSensitive) {
        // For time-sensitive queries, add year
        importantWords.push(currentYear.toString());
        console.log(`[AutoSearch] Added temporal context for time-sensitive query: ${currentYear}`);
      }
    }

    // Join words back together
    const optimizedQuery = importantWords.join(' ');
    
    console.log(`[AutoSearch] Query optimization: "${query}" → "${optimizedQuery}"`);
    
    return optimizedQuery;
  }

  /**
   * Perform complete search operation
   * Coordinates SearchOrchestrator, RAGProcessor, and ContextFormatter
   * Emits events for progressive UI updates
   */
  async performSearch(query: string, options?: SearchOptions): Promise<SearchContext> {
    const startTime = Date.now();

    try {
      // Step 1: Extract optimized search query
      const searchQuery = this.extractSearchQuery(query);
      console.log(`Auto-search: "${query}" → "${searchQuery}"`);

      // Emit search started event
      const maxResults = options?.maxResults || this.config.maxResults;
      this.eventEmitter.emit(createSearchEvent<SearchStartedEvent>('search_started', {
        query: searchQuery,
        maxResults
      }));

      // Step 2: Check cache first
      const cached = this.orchestrator.getCached(searchQuery);
      if (cached) {
        console.log('Auto-search: Using cached results');
        
        // Emit completion event for cached results
        this.eventEmitter.emit(createSearchEvent<SearchCompletedEvent>('search_completed', {
          query: searchQuery,
          totalTime: 0,
          chunkCount: cached.chunks.length,
          sourceCount: cached.sources.length
        }));
        
        return cached;
      }

      // Step 3: Execute search
      const searchResults = await this.orchestrator.search(searchQuery, maxResults);

      if (searchResults.length === 0) {
        console.warn('Auto-search: No search results found');
        this.eventEmitter.emit(createSearchEvent<SearchErrorEvent>('search_error', {
          error: 'No search results found',
          phase: 'search'
        }));
        return this.createEmptyContext(searchQuery);
      }

      console.log(`Auto-search: Found ${searchResults.length} results`);
      
      // Emit search results found event
      this.eventEmitter.emit(createSearchEvent<SearchResultsFoundEvent>('search_results_found', {
        resultCount: searchResults.length,
        results: searchResults.map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet
        }))
      }));

      // Step 4: Scrape content from URLs
      const urls = searchResults.map(r => r.url);
      
      // Emit scraping started event
      this.eventEmitter.emit(createSearchEvent<ScrapingStartedEvent>('scraping_started', {
        urlCount: urls.length,
        urls
      }));
      
      const scrapingStartTime = Date.now();
      const scrapedContent = await this.orchestrator.scrapeContent(urls);
      const scrapingTime = Date.now() - scrapingStartTime;

      if (scrapedContent.length === 0) {
        console.warn('Auto-search: Failed to scrape any content');
        this.eventEmitter.emit(createSearchEvent<SearchErrorEvent>('search_error', {
          error: 'Failed to scrape any content',
          phase: 'scraping'
        }));
        return this.createEmptyContext(searchQuery);
      }

      console.log(`Auto-search: Scraped ${scrapedContent.length} pages`);
      
      // Emit scraping completed event
      this.eventEmitter.emit(createSearchEvent<ScrapingCompletedEvent>('scraping_completed', {
        successCount: scrapedContent.length,
        failureCount: urls.length - scrapedContent.length,
        totalTime: scrapingTime
      }));

      // Step 5: Process with RAG (lazy-loaded)
      this.eventEmitter.emit(createSearchEvent<ProcessingStartedEvent>('processing_started', {
        contentCount: scrapedContent.length
      }));
      
      const ragProcessor = await this.getRAGProcessor();
      const processedContext = await ragProcessor.process(searchQuery, scrapedContent);

      console.log(
        `Auto-search: Selected ${processedContext.selectedChunks}/${processedContext.totalChunks} chunks`
      );

      // Step 6: Extract sources
      const sources = this.extractSources(processedContext.chunks);

      // Emit processing completed event
      this.eventEmitter.emit(createSearchEvent<ProcessingCompletedEvent>('processing_completed', {
        totalChunks: processedContext.totalChunks,
        selectedChunks: processedContext.selectedChunks,
        sources: sources.length
      }));

      // Step 7: Create summary
      const summary = this.createSummary(processedContext);

      // Step 8: Build search context
      const searchContext: SearchContext = {
        query: searchQuery,
        chunks: processedContext.chunks,
        sources,
        summary,
        timestamp: Date.now()
      };

      // Step 9: Cache the result
      this.orchestrator.setCached(searchQuery, searchContext);

      const searchTime = Date.now() - startTime;
      console.log(`Auto-search: Completed in ${searchTime}ms`);

      // Emit search completed event
      this.eventEmitter.emit(createSearchEvent<SearchCompletedEvent>('search_completed', {
        query: searchQuery,
        totalTime: searchTime,
        chunkCount: processedContext.selectedChunks,
        sourceCount: sources.length
      }));

      return searchContext;

    } catch (error) {
      console.error('Auto-search failed:', error);
      
      // Emit error event
      this.eventEmitter.emit(createSearchEvent<SearchErrorEvent>('search_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        phase: 'search'
      }));
      
      return this.createEmptyContext(query, error);
    }
  }

  /**
   * Inject search context into user message
   * Formats the context and prepends it to the user's query
   */
  async injectContext(userMessage: string, context: SearchContext): Promise<string> {
    // Get formatter (lazy-loaded)
    const formatter = await this.getFormatter();
    
    // Format context using configured output format
    let formattedContext = formatter.format(
      {
        query: context.query,
        chunks: context.chunks,
        totalChunks: context.chunks.length,
        selectedChunks: context.chunks.length
      },
      this.config.outputFormat
    );

    // Optimize length if needed
    if (formattedContext.length > this.config.maxContextLength) {
      formattedContext = formatter.optimizeLength(
        formattedContext,
        this.config.maxContextLength
      );
    }

    // Add source attribution if not already included
    if (this.config.outputFormat !== 'verbose') {
      formattedContext = formatter.addSourceAttribution(
        formattedContext,
        context.sources
      );
    }

    // Build enhanced message with system prompt
    const systemPrompt = this.buildSystemPrompt(context);
    const enhancedMessage = `${systemPrompt}

${formattedContext}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❓ USER'S QUESTION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${userMessage}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 YOUR TASK: Answer the user's question above using the web search results provided. Be specific, accurate, and cite sources using [1], [2], etc.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    console.log('[AutoSearchManager] Enhanced message preview (first 800 chars):', enhancedMessage.substring(0, 800));
    console.log('[AutoSearchManager] Total enhanced message length:', enhancedMessage.length);
    console.log('[AutoSearchManager] Sources included:', context.sources.length);
    console.log('[AutoSearchManager] Chunks included:', context.chunks.length);

    return enhancedMessage;
  }

  /**
   * Configure the auto-search manager
   */
  configure(config: Partial<AutoSearchConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): AutoSearchConfig {
    return { ...this.config };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Check if query contains question words
   */
  private hasQuestionWords(query: string): boolean {
    const allQuestionWords = [...GERMAN_QUESTION_WORDS, ...ENGLISH_QUESTION_WORDS];
    return allQuestionWords.some(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      return regex.test(query);
    });
  }

  /**
   * Check if query contains time-related references
   */
  private hasTimeReference(query: string): boolean {
    return TIME_KEYWORDS.some(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(query);
    });
  }

  /**
   * Check if query contains information request keywords
   */
  private hasInfoRequest(query: string): boolean {
    return INFO_REQUEST_KEYWORDS.some(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(query);
    });
  }

  /**
   * Check if this is a follow-up question
   * Follow-ups are typically short and come after recent messages
   */
  private isFollowUpQuestion(query: string, history: Message[]): boolean {
    // Need at least one previous message
    if (history.length === 0) {
      return false;
    }

    const lastMessage = history[history.length - 1];
    const timeSinceLastMessage = Date.now() - lastMessage.timestamp;
    
    // Only consider follow-ups within 2 minutes
    if (timeSinceLastMessage > 120000) {
      return false;
    }

    const lowerQuery = query.toLowerCase();

    // Check if query starts with follow-up indicators
    const followUpIndicators = [
      'und', 'also', 'aber', 'noch', 'mehr', 'weiter', 'außerdem',
      'and', 'also', 'but', 'more', 'further', 'what about', 'additionally'
    ];
    
    const startsWithFollowUp = followUpIndicators.some(indicator =>
      lowerQuery.startsWith(indicator + ' ')
    );
    
    if (startsWithFollowUp) {
      return true;
    }

    // Short queries (< 25 chars) that are vague are likely follow-ups
    if (query.length < 25) {
      const vaguePatterns = [
        /^(und|also|aber|noch|mehr)\s/i,
        /^(and|also|but|more)\s/i,
        /^(wie|what|how)\s+(about|ist|geht)/i,
        /^(danke|thanks|ok|okay|gut|good)/i
      ];

      if (vaguePatterns.some(pattern => pattern.test(query))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract unique sources from chunks
   */
  private extractSources(chunks: ContentChunk[]): Source[] {
    const sourceMap = new Map<string, Source>();

    for (const chunk of chunks) {
      if (!sourceMap.has(chunk.source)) {
        sourceMap.set(chunk.source, {
          url: chunk.source,
          title: this.extractTitleFromURL(chunk.source),
          domain: chunk.metadata.domain,
          publishedDate: chunk.metadata.publishedDate
        });
      }
    }

    return Array.from(sourceMap.values());
  }

  /**
   * Extract title from URL
   */
  private extractTitleFromURL(urlString: string): string {
    try {
      const url = new URL(urlString);
      const path = url.pathname;
      const segments = path.split('/').filter(s => s.length > 0);
      
      if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1];
        return lastSegment
          .replace(/\.[^.]+$/, '')
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());
      }

      return url.hostname;
    } catch {
      return urlString;
    }
  }

  /**
   * Create a summary of the search results
   */
  private createSummary(context: { chunks: ContentChunk[]; totalChunks: number; selectedChunks: number }): string {
    const sources = new Set(context.chunks.map(c => c.metadata.domain));
    const sourceCount = sources.size;
    
    return `Found ${context.selectedChunks} relevant sections from ${sourceCount} source(s).`;
  }

  /**
   * Create empty context for failed searches
   */
  private createEmptyContext(query: string, error?: any): SearchContext {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      query,
      chunks: [],
      sources: [],
      summary: `Search failed: ${errorMessage}`,
      timestamp: Date.now()
    };
  }

  /**
   * Build system prompt for context usage
   */
  private buildSystemPrompt(context: SearchContext): string {
    const sourceCount = context.sources.length;
    const chunkCount = context.chunks.length;
    
    // Get current date for context
    const now = new Date();
    const dateString = now.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 WEB SEARCH RESULTS PROVIDED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

I have searched the web and found current information from ${sourceCount} reliable source(s).
Below are ${chunkCount} relevant section(s) extracted from these sources.

🗓️ CURRENT DATE: ${dateString}

⚠️ CRITICAL: YOU MUST USE THE INFORMATION BELOW TO ANSWER THE USER'S QUESTION

📋 INSTRUCTIONS FOR USING WEB SEARCH RESULTS:

1. **USE THE PROVIDED INFORMATION**: The search results below contain current, relevant information. You MUST base your answer primarily on this information.

2. **Date Awareness**: Today is ${dateString}. Interpret all dates relative to today.

3. **Latest Information**: 
   - When asked about "latest" or "current" versions, use the MOST RECENT information from the search results
   - Clearly state version numbers and release dates found in the results
   - If multiple versions are mentioned, identify which is the latest

4. **Be Specific and Cite Sources**:
   - Reference specific sources when making claims (e.g., "According to the official documentation...")
   - Include relevant details like version numbers, dates, and specific features
   - Use the [1], [2], [3] citation numbers provided in the search results

5. **Acknowledge Limitations**:
   - If the search results don't fully answer the question, say so
   - If information seems outdated or contradictory, mention this
   - Don't make up information not present in the search results

6. **Structure Your Answer**:
   - Start by directly answering the user's question using the search results
   - Provide relevant details and examples from the sources
   - Keep your answer clear, accurate, and well-organized

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 SEARCH RESULTS (Use this information to answer):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const autoSearchManager = new AutoSearchManager();
