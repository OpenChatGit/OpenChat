// RAG (Retrieval-Augmented Generation) System for Web Search

import type { ScrapedContent, ContentChunk, RAGContext, SearchResult } from './types'

export class RAGProcessor {
  private chunkSize: number
  private chunkOverlap: number

  constructor(chunkSize = 1000, chunkOverlap = 200) {
    this.chunkSize = chunkSize
    this.chunkOverlap = chunkOverlap
  }

  /**
   * Process search results into RAG context
   */
  async processSearchResults(
    query: string,
    searchResults: SearchResult[],
    scrapedContent: ScrapedContent[]
  ): Promise<RAGContext> {
    // Create chunks from scraped content
    const allChunks = this.createChunksFromContent(scrapedContent)

    // Rank chunks by relevance to query
    const rankedChunks = this.rankChunksByRelevance(query, allChunks)

    // Select top relevant chunks
    const relevantChunks = rankedChunks.slice(0, 10)

    // Generate summary
    const summary = this.generateSummary(relevantChunks)

    // Extract unique sources
    const sources = [...new Set(relevantChunks.map(c => c.source))]

    return {
      query,
      results: searchResults,
      relevantChunks,
      summary,
      sources,
    }
  }

  /**
   * Create chunks from scraped content
   */
  private createChunksFromContent(contents: ScrapedContent[]): ContentChunk[] {
    const chunks: ContentChunk[] = []

    for (const content of contents) {
      const contentChunks = this.chunkText(content.content)
      
      contentChunks.forEach((text, index) => {
        chunks.push({
          content: text,
          source: content.url,
          relevance: 0, // Will be calculated later
          metadata: {
            position: index,
            length: text.length,
          },
        })
      })
    }

    return chunks
  }

  /**
   * Split text into overlapping chunks
   */
  private chunkText(text: string): string[] {
    const chunks: string[] = []
    let start = 0

    while (start < text.length) {
      const end = Math.min(start + this.chunkSize, text.length)
      const chunk = text.slice(start, end)
      
      // Try to break at sentence boundary
      if (end < text.length) {
        const lastPeriod = chunk.lastIndexOf('.')
        const lastNewline = chunk.lastIndexOf('\n')
        const breakPoint = Math.max(lastPeriod, lastNewline)
        
        if (breakPoint > this.chunkSize * 0.5) {
          chunks.push(chunk.slice(0, breakPoint + 1).trim())
          start += breakPoint + 1
        } else {
          chunks.push(chunk.trim())
          start += this.chunkSize - this.chunkOverlap
        }
      } else {
        chunks.push(chunk.trim())
        break
      }
    }

    return chunks.filter(c => c.length > 50) // Filter out very short chunks
  }

  /**
   * Rank chunks by relevance to query using simple keyword matching
   */
  private rankChunksByRelevance(query: string, chunks: ContentChunk[]): ContentChunk[] {
    const queryTerms = this.extractKeywords(query.toLowerCase())

    return chunks
      .map(chunk => {
        const chunkText = chunk.content.toLowerCase()
        let score = 0

        // Calculate relevance score
        for (const term of queryTerms) {
          const termCount = (chunkText.match(new RegExp(term, 'g')) || []).length
          score += termCount * (term.length > 3 ? 2 : 1) // Weight longer terms more
        }

        // Bonus for chunks with multiple query terms
        const termsFound = queryTerms.filter(term => chunkText.includes(term)).length
        score += termsFound * 5

        return {
          ...chunk,
          relevance: score,
        }
      })
      .sort((a, b) => b.relevance - a.relevance)
      .filter(chunk => chunk.relevance > 0) // Only keep relevant chunks
  }

  /**
   * Extract keywords from query
   */
  private extractKeywords(text: string): string[] {
    // Remove common stop words
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'can', 'what', 'when', 'where',
      'who', 'why', 'how', 'which', 'this', 'that', 'these', 'those',
    ])

    return text
      .split(/\s+/)
      .map(word => word.replace(/[^\w]/g, ''))
      .filter(word => word.length > 2 && !stopWords.has(word))
  }

  /**
   * Generate summary from relevant chunks
   */
  private generateSummary(chunks: ContentChunk[]): string {
    if (chunks.length === 0) {
      return 'No relevant information found.'
    }

    // Take first 3 most relevant chunks and combine them
    const topChunks = chunks.slice(0, 3)
    const summaryParts = topChunks.map(chunk => {
      // Take first 200 characters of each chunk
      const preview = chunk.content.slice(0, 200)
      const lastSpace = preview.lastIndexOf(' ')
      return lastSpace > 0 ? preview.slice(0, lastSpace) + '...' : preview + '...'
    })

    return summaryParts.join('\n\n')
  }

  /**
   * Format RAG context for AI consumption
   */
  formatContextForAI(context: RAGContext): string {
    let formatted = `# Web Search Results for: "${context.query}"\n\n`

    formatted += `## Summary\n${context.summary}\n\n`

    formatted += `## Relevant Information\n\n`
    context.relevantChunks.slice(0, 5).forEach((chunk, index) => {
      formatted += `### Source ${index + 1}: ${chunk.source}\n`
      formatted += `${chunk.content}\n\n`
    })

    formatted += `## All Sources\n`
    context.sources.forEach((source, index) => {
      formatted += `${index + 1}. ${source}\n`
    })

    return formatted
  }

  /**
   * Format RAG context as compact JSON for AI
   */
  formatContextAsJSON(context: RAGContext): string {
    return JSON.stringify({
      query: context.query,
      summary: context.summary,
      chunks: context.relevantChunks.slice(0, 5).map(c => ({
        content: c.content,
        source: c.source,
        relevance: c.relevance,
      })),
      sources: context.sources,
    }, null, 2)
  }
}
