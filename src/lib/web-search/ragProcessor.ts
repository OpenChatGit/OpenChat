/**
 * RAGProcessor - Handles content chunking, relevance scoring, and chunk selection
 * for Retrieval-Augmented Generation
 */

import type {
  ScrapedContent,
  ContentChunk,
  ProcessedContext,
  RAGConfig,
  ChunkMetadata
} from './types';
import { DEFAULT_RAG_CONFIG } from './types';

export class RAGProcessor {
  private config: RAGConfig;

  constructor(config?: Partial<RAGConfig>) {
    this.config = { ...DEFAULT_RAG_CONFIG, ...config };
  }

  /**
   * Process scraped content into relevant chunks
   */
  async process(query: string, contents: ScrapedContent[]): Promise<ProcessedContext> {
    // Step 1: Chunk all content
    const allChunks: ContentChunk[] = [];

    for (const content of contents) {
      const chunks = this.chunkContent(content);
      allChunks.push(...chunks);
    }

    // Step 2: Score chunks for relevance
    const scoredChunks = this.scoreChunks(query, allChunks);

    // Step 3: Select best chunks
    const selectedChunks = this.selectChunks(scoredChunks);

    return {
      query,
      chunks: selectedChunks,
      totalChunks: allChunks.length,
      selectedChunks: selectedChunks.length
    };
  }

  /**
   * Chunk content into semantic pieces at sentence boundaries
   */
  chunkContent(content: ScrapedContent): ContentChunk[] {
    const chunks: ContentChunk[] = [];
    const text = content.content;

    if (!text || text.trim().length === 0) {
      return chunks;
    }

    // Split into sentences (basic sentence boundary detection)
    const sentences = this.splitIntoSentences(text);

    let currentChunk = '';
    let position = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;

      // Check if adding this sentence would exceed chunk size
      if (potentialChunk.length > this.config.chunkSize && currentChunk.length > 0) {
        // Save current chunk if it meets minimum size
        if (currentChunk.length >= 100) {
          chunks.push(this.createChunk(currentChunk, content, position));
          position++;
        }

        // Start new chunk with overlap
        currentChunk = this.getOverlapText(currentChunk) + sentence;
      } else {
        currentChunk = potentialChunk;
      }

      // Enforce maximum chunk size
      if (currentChunk.length > 2000) {
        const truncated = currentChunk.substring(0, 2000);
        chunks.push(this.createChunk(truncated, content, position));
        position++;
        currentChunk = this.getOverlapText(truncated);
      }
    }

    // Add remaining chunk
    if (currentChunk.length >= 100) {
      chunks.push(this.createChunk(currentChunk, content, position));
    }

    return chunks;
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Split on sentence boundaries (., !, ?) followed by space and capital letter
    // Also handle common abbreviations
    const sentences: string[] = [];
    const regex = /[.!?]+[\s]+(?=[A-Z])/g;

    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const sentence = text.substring(lastIndex, match.index + match[0].length).trim();
      if (sentence.length > 0) {
        sentences.push(sentence);
      }
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    const remaining = text.substring(lastIndex).trim();
    if (remaining.length > 0) {
      sentences.push(remaining);
    }

    return sentences.length > 0 ? sentences : [text];
  }

  /**
   * Get overlap text from the end of a chunk
   */
  private getOverlapText(chunk: string): string {
    if (chunk.length <= this.config.chunkOverlap) {
      return chunk;
    }

    // Get last N characters, but try to start at a word boundary
    const overlapText = chunk.substring(chunk.length - this.config.chunkOverlap);
    const firstSpace = overlapText.indexOf(' ');

    if (firstSpace > 0 && firstSpace < overlapText.length / 2) {
      return overlapText.substring(firstSpace + 1);
    }

    return overlapText;
  }

  /**
   * Create a ContentChunk from text and metadata
   */
  private createChunk(
    text: string,
    content: ScrapedContent,
    position: number
  ): ContentChunk {
    const metadata: ChunkMetadata = {
      wordCount: text.split(/\s+/).length,
      publishedDate: content.metadata.publishedDate,
      domain: content.metadata.domain,
      isTrustedDomain: this.config.trustedDomains.includes(content.metadata.domain)
    };

    return {
      content: text.trim(),
      source: content.url,
      relevanceScore: 0, // Will be calculated later
      position,
      metadata
    };
  }

  /**
   * Score chunks for relevance to the query
   */
  private scoreChunks(query: string, chunks: ContentChunk[]): ContentChunk[] {
    const queryTerms = this.extractTerms(query);
    const idf = this.calculateIDF(chunks, queryTerms);

    return chunks.map(chunk => {
      const termMatchScore = this.calculateTermMatchScore(chunk, queryTerms, idf);
      const positionScore = this.calculatePositionScore(chunk);
      const recencyScore = this.calculateRecencyScore(chunk);
      const qualityScore = this.calculateQualityScore(chunk);
      const domainTrustScore = chunk.metadata.isTrustedDomain ? 1.0 : 0.5;

      // Combined relevance score with configurable weights
      const relevanceScore = (
        termMatchScore * 0.5 +
        positionScore * 0.2 +
        recencyScore * this.config.recencyWeight +
        qualityScore * this.config.qualityWeight +
        domainTrustScore * 0.1
      );

      return {
        ...chunk,
        relevanceScore
      };
    });
  }

  /**
   * Extract terms from text (remove stopwords, lowercase)
   */
  private extractTerms(text: string): string[] {
    const stopwords = new Set([
      'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'eines',
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
      'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this',
      'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
    ]);

    return text
      .toLowerCase()
      .split(/\W+/)
      .filter(term => term.length > 2 && !stopwords.has(term));
  }

  /**
   * Calculate IDF (Inverse Document Frequency) for terms
   */
  private calculateIDF(chunks: ContentChunk[], terms: string[]): Map<string, number> {
    const idf = new Map<string, number>();
    const totalDocs = chunks.length;

    for (const term of terms) {
      const docsWithTerm = chunks.filter(chunk =>
        chunk.content.toLowerCase().includes(term)
      ).length;

      if (docsWithTerm > 0) {
        idf.set(term, Math.log(totalDocs / docsWithTerm));
      }
    }

    return idf;
  }

  /**
   * Calculate TF-IDF based term matching score
   */
  private calculateTermMatchScore(
    chunk: ContentChunk,
    queryTerms: string[],
    idf: Map<string, number>
  ): number {
    const chunkText = chunk.content.toLowerCase();
    const chunkTerms = this.extractTerms(chunkText);

    let score = 0;
    const termFreq = new Map<string, number>();

    // Calculate term frequency
    for (const term of chunkTerms) {
      termFreq.set(term, (termFreq.get(term) || 0) + 1);
    }

    // Calculate TF-IDF score
    for (const queryTerm of queryTerms) {
      const tf = termFreq.get(queryTerm) || 0;
      const idfValue = idf.get(queryTerm) || 0;
      score += tf * idfValue;
    }

    // Normalize by chunk length
    return chunkTerms.length > 0 ? score / Math.sqrt(chunkTerms.length) : 0;
  }

  /**
   * Calculate position score (earlier chunks preferred)
   */
  private calculatePositionScore(chunk: ContentChunk): number {
    // Exponential decay: first chunk = 1.0, later chunks decrease
    return Math.exp(-chunk.position * 0.1);
  }

  /**
   * Calculate recency score (newer content preferred)
   */
  private calculateRecencyScore(chunk: ContentChunk): number {
    if (!chunk.metadata.publishedDate) {
      return 0.5; // Neutral score for unknown dates
    }

    const now = Date.now();
    const published = chunk.metadata.publishedDate.getTime();
    const ageInDays = (now - published) / (1000 * 60 * 60 * 24);

    // Exponential decay: recent = 1.0, older decreases
    if (ageInDays < 0) return 0.5; // Future dates get neutral score
    if (ageInDays < 7) return 1.0;
    if (ageInDays < 30) return 0.9;
    if (ageInDays < 90) return 0.7;
    if (ageInDays < 365) return 0.5;
    return 0.3;
  }

  /**
   * Calculate quality score based on length, structure, readability
   */
  private calculateQualityScore(chunk: ContentChunk): number {
    const text = chunk.content;
    const wordCount = chunk.metadata.wordCount;

    // Length score (prefer medium-length chunks)
    let lengthScore = 0;
    if (wordCount >= 50 && wordCount <= 300) {
      lengthScore = 1.0;
    } else if (wordCount < 50) {
      lengthScore = wordCount / 50;
    } else {
      lengthScore = Math.max(0.5, 1.0 - (wordCount - 300) / 500);
    }

    // Structure score (has punctuation, capitalization)
    const hasPunctuation = /[.!?]/.test(text);
    const hasCapitalization = /[A-Z]/.test(text);
    const structureScore = (hasPunctuation ? 0.5 : 0) + (hasCapitalization ? 0.5 : 0);

    // Readability score (not too many long words)
    const words = text.split(/\s+/);
    const longWords = words.filter(w => w.length > 12).length;
    const readabilityScore = Math.max(0, 1.0 - (longWords / words.length) * 2);

    return (lengthScore * 0.5 + structureScore * 0.3 + readabilityScore * 0.2);
  }

  /**
   * Select best chunks based on relevance and diversity
   */
  selectChunks(chunks: ContentChunk[]): ContentChunk[] {
    // Filter by relevance threshold
    let filtered = chunks.filter(
      chunk => chunk.relevanceScore >= this.config.relevanceThreshold
    );

    // Sort by relevance score (descending)
    filtered.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Apply diversity: max 3 chunks per source
    const selected: ContentChunk[] = [];
    const sourceCount = new Map<string, number>();

    for (const chunk of filtered) {
      const count = sourceCount.get(chunk.source) || 0;

      if (count < 3) {
        selected.push(chunk);
        sourceCount.set(chunk.source, count + 1);
      }

      if (selected.length >= this.config.maxChunks) {
        break;
      }
    }

    // Remove duplicates using cosine similarity
    return this.removeDuplicates(selected);
  }

  /**
   * Remove duplicate chunks using cosine similarity
   */
  private removeDuplicates(chunks: ContentChunk[]): ContentChunk[] {
    const unique: ContentChunk[] = [];

    for (const chunk of chunks) {
      let isDuplicate = false;

      for (const existing of unique) {
        const similarity = this.cosineSimilarity(chunk.content, existing.content);
        if (similarity > 0.9) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        unique.push(chunk);
      }
    }

    return unique;
  }

  /**
   * Calculate cosine similarity between two texts
   */
  private cosineSimilarity(text1: string, text2: string): number {
    const terms1 = this.extractTerms(text1);
    const terms2 = this.extractTerms(text2);

    // Create term frequency vectors
    const allTerms = new Set([...terms1, ...terms2]);
    const vector1: number[] = [];
    const vector2: number[] = [];

    for (const term of allTerms) {
      vector1.push(terms1.filter(t => t === term).length);
      vector2.push(terms2.filter(t => t === term).length);
    }

    // Calculate dot product and magnitudes
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      magnitude1 += vector1[i] * vector1[i];
      magnitude2 += vector2[i] * vector2[i];
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Configure the RAG processor
   */
  configure(config: Partial<RAGConfig>): void {
    this.config = { ...this.config, ...config };
    this.validateConfig();
  }

  /**
   * Get current configuration
   */
  getConfig(): RAGConfig {
    return { ...this.config };
  }

  /**
   * Validate configuration values
   */
  private validateConfig(): void {
    if (this.config.chunkSize < 100 || this.config.chunkSize > 2000) {
      throw new Error('chunkSize must be between 100 and 2000');
    }

    if (this.config.chunkOverlap < 0 || this.config.chunkOverlap >= this.config.chunkSize) {
      throw new Error('chunkOverlap must be between 0 and chunkSize');
    }

    if (this.config.maxChunks < 1) {
      throw new Error('maxChunks must be at least 1');
    }

    if (this.config.relevanceThreshold < 0 || this.config.relevanceThreshold > 1) {
      throw new Error('relevanceThreshold must be between 0 and 1');
    }

    if (this.config.recencyWeight < 0 || this.config.recencyWeight > 1) {
      throw new Error('recencyWeight must be between 0 and 1');
    }

    if (this.config.qualityWeight < 0 || this.config.qualityWeight > 1) {
      throw new Error('qualityWeight must be between 0 and 1');
    }
  }
}
