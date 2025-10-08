// Web Scraper with Queue Management and Tauri Backend

import { invoke } from '@tauri-apps/api/core'
import type { SearchResult, ScrapedContent, WebSearchConfig } from './types'

type ContentSegment = {
  text: string
  tag: string
}

export class WebScraper {
  private queue: Array<() => Promise<void>> = []
  private activeRequests = 0
  private config: WebSearchConfig

  constructor(config: Partial<WebSearchConfig> = {}) {
    this.config = {
      maxConcurrentRequests: config.maxConcurrentRequests || 3,
      requestTimeout: config.requestTimeout || 10000,
      maxResultsPerQuery: config.maxResultsPerQuery || 5,
      chunkSize: config.chunkSize || 1000,
      chunkOverlap: config.chunkOverlap || 200,
      enableCache: config.enableCache ?? true,
      cacheExpiry: config.cacheExpiry || 3600000, // 1 hour
    }
  }

  /**
   * Search using DuckDuckGo (no API key needed)
   */
  async search(query: string, maxResults?: number): Promise<SearchResult[]> {
    const limit = maxResults || this.config.maxResultsPerQuery
    
    try {
      // Use DuckDuckGo HTML search via Tauri backend (CORS bypass)
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
      
      console.log('Fetching search results via Tauri backend...')
      const html = await invoke<string>('fetch_url', { url: searchUrl })
      
      const results = this.parseDuckDuckGoResults(html, limit)
      
      return results
    } catch (error) {
      console.error('Search error:', error)
      return []
    }
  }

  /**
   * Parse DuckDuckGo HTML results
   */
  private parseDuckDuckGoResults(html: string, limit: number): SearchResult[] {
    const results: SearchResult[] = []

    // Prefer DOM parsing for flexibility (available in browser/WebView environment)
    if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')
        const nodes = Array.from(doc.querySelectorAll('.result__body, .result__wrapper'))

        for (const node of nodes) {
          if (results.length >= limit) break

          const link = node.querySelector<HTMLAnchorElement>('.result__a')
          if (!link) continue

          const snippetNode = node.querySelector<HTMLElement>('.result__snippet, .result__snippet.js-result-snippet, .result__snippet.js-result-snippet span')

          const url = this.decodeUrl(link.getAttribute('href') || '')
          const title = this.cleanText(link.textContent || '')
          const snippet = snippetNode ? this.cleanText(snippetNode.textContent || '') : ''

          if (!url || !title) continue

          results.push({
            title,
            url,
            snippet,
            timestamp: Date.now(),
          })
        }
      } catch (error) {
        console.warn('DOM parsing of DuckDuckGo results failed, falling back to regex:', error)
      }
    }

    if (results.length >= limit) {
      return results.slice(0, limit)
    }

    // Fallback regex-based parsing (if DOMParser unavailable or yielded no results)
    const resultRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?(?:<a[^>]+class="result__snippet"[^>]*>([^<]*)<\/a>|<div[^>]+class="result__snippet"[^>]*>([^<]*)<\/div>)/g

    let match
    while (results.length < limit && (match = resultRegex.exec(html)) !== null) {
      const url = this.decodeUrl(match[1])
      const title = this.cleanText(match[2])
      const snippet = this.cleanText(match[3] || match[4] || '')

      if (!url || !title) continue

      results.push({
        title,
        url,
        snippet,
        timestamp: Date.now(),
      })
    }

    return results.slice(0, limit)
  }

  /**
   * Scrape content from a URL with queue management
   */
  async scrapeUrl(result: SearchResult, query: string): Promise<ScrapedContent | null> {
    return new Promise((resolve) => {
      const task = async () => {
        try {
          this.activeRequests++
          const content = await this.fetchAndExtractContent(result.url, query, result.snippet)
          resolve(content)
        } catch (error) {
          console.error(`Failed to scrape ${result.url}:`, error)
          resolve(null)
        } finally {
          this.activeRequests--
          this.processQueue()
        }
      }

      if (this.activeRequests < this.config.maxConcurrentRequests) {
        task()
      } else {
        this.queue.push(task)
      }
    })
  }

  /**
   * Scrape multiple URLs concurrently with queue management
   */
  async scrapeMultiple(results: SearchResult[], query: string): Promise<ScrapedContent[]> {
    const promises = results.map(result => this.scrapeUrl(result, query))
    const scraped = await Promise.all(promises)
    return scraped.filter((item): item is ScrapedContent => {
      if (!item) {
        return false
      }

      if (!item.content || item.content.trim().length === 0) {
        return false
      }

      if (item.metadata?.relevanceScore !== undefined && item.metadata.relevanceScore <= 0) {
        return false
      }

      return true
    })
  }

  /**
   */
  private async fetchAndExtractContent(url: string, query: string, hint?: string): Promise<ScrapedContent | null> {
    console.log('Scraping URL via Tauri backend:', url)
    const html = await invoke<string>('fetch_url', { url })
    
    const segments = this.extractContentSegments(html)
    const relevanceResult = this.extractRelevantContent(segments, query, hint)

    if (!relevanceResult || relevanceResult.score === 0 || relevanceResult.content.trim().length === 0) {
      return null
    }

    const fallbackContent = relevanceResult.content

    const title = this.extractTitle(html)

    return {
      url,
      title: title || url,
      content: fallbackContent,
      metadata: {
        scrapedAt: Date.now(),
        contentLength: fallbackContent.length,
        relevanceScore: relevanceResult.score,
      },
    }
  }

  /**
   * Extract relevant content segments from HTML
   * Extract main content from HTML (simple version)
   */
  private extractMainContent(html: string): string {
    // Remove script and style tags
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    
    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, ' ')
    
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim()
    
    // Decode HTML entities
    text = this.decodeHtmlEntities(text)
    
    return text
  }

  private extractContentSegments(html: string): ContentSegment[] {
    const doc = this.parseHtml(html)

    if (doc) {
      const mainNode = this.findMainContentNode(doc)
      if (mainNode) {
        const elements = Array.from(
          mainNode.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, blockquote, pre, code')
        )

        const segments = elements
          .map(element => {
            const rawText = element.textContent || ''
            const cleaned = this.cleanText(rawText)
            const tag = element.tagName.toLowerCase()

            if (!cleaned || this.isLowValueSegment(cleaned)) {
              return null
            }

            if (tag === 'li') {
              return { text: `• ${cleaned}`, tag }
            }

            if (tag === 'code' || tag === 'pre') {
              return cleaned.length > 30 ? { text: cleaned, tag } : null
            }

            return cleaned.length > 0 ? { text: cleaned, tag } : null
          })
          .filter((segment): segment is ContentSegment => segment !== null)

        if (segments.length > 0) {
          return segments
        }
      }
    }

    const fallbackText = this.extractMainContent(html)
    return this.splitPlainTextIntoSegments(fallbackText)
  }

  /**
   * Extract only the most relevant sentences for the given query
   */
  private extractRelevantContent(segments: ContentSegment[], query: string, hint?: string): { content: string; score: number } | null {
    const cleanedSegments = segments
      .map(segment => ({ ...segment, text: this.cleanText(segment.text) }))
      .filter(segment => segment.text.length > 0 && !this.isLowValueSegment(segment.text))

    if (cleanedSegments.length === 0) {
      return null
    }

    const keywords = new Set([
      ...this.extractKeywords(query),
      ...(hint ? this.extractKeywords(hint) : []),
    ].map(word => word.toLowerCase()))

    const timeRegex = /\b\d{1,2}:\d{2}(?::\d{2})?\b/
    const dateRegex = /\b(\d{1,2}[\.\/-]\d{1,2}[\.\/-]\d{2,4}|20\d{2}-\d{2}-\d{2}|\d{1,2}\s*(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec))\b/i

    const scored = cleanedSegments.map((segment, index) => {
      const lower = segment.text.toLowerCase()
      let score = 0

      keywords.forEach(keyword => {
        if (keyword && lower.includes(keyword)) {
          score += keyword.length > 7 ? 6 : keyword.length > 4 ? 4 : 2
        }
      })

      if (timeRegex.test(segment.text)) score += 5
      if (dateRegex.test(segment.text)) score += 4
      if (segment.tag.startsWith('h')) score += 3

      return {
        index,
        segment,
        score,
      }
    })

    const relevant = scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)

    if (relevant.length === 0) {
      return null
    }

    const baseSelection = relevant.slice(0, 5)

    const indices = new Set<number>()

    baseSelection.forEach(item => {
      indices.add(item.index)

      const current = cleanedSegments[item.index]
      if (current.tag.startsWith('h') && item.index + 1 < cleanedSegments.length) {
        indices.add(item.index + 1)
      }

      if (current.tag === 'li') {
        if (item.index > 0 && cleanedSegments[item.index - 1].tag === 'li') {
          indices.add(item.index - 1)
        }
        if (item.index + 1 < cleanedSegments.length && cleanedSegments[item.index + 1].tag === 'li') {
          indices.add(item.index + 1)
        }
      }

      if (current.text.length < 80) {
        if (item.index + 1 < cleanedSegments.length) {
          indices.add(item.index + 1)
        }
        if (item.index > 0) {
          indices.add(item.index - 1)
        }
      }
    })

    const ordered = Array.from(indices).sort((a, b) => a - b)
    const combined = ordered.map(index => cleanedSegments[index].text).join('\n\n')

    const content = this.truncateContent(combined, 1500)
    const aggregateScore = baseSelection.reduce((sum, item) => sum + item.score, 0)

    return {
      content,
      score: aggregateScore,
    }
  }

  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-z0-9äöüß]+/i)
      .map(word => word.trim())
      .filter(word => word.length > 3)
  }

  /**
   * Extract title from HTML
   */
  private extractTitle(html: string): string {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    return titleMatch ? this.cleanText(titleMatch[1]) : ''
  }

  private parseHtml(html: string): Document | null {
    if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
      return null
    }

    try {
      const parser = new DOMParser()
      return parser.parseFromString(html, 'text/html')
    } catch {
      return null
    }
  }

  private findMainContentNode(doc: Document): Element | null {
    const selectors = [
      'article',
      'main',
      '[role="main"]',
      '#content',
      '#main',
      '.article',
      '.post',
      '.content',
      '.entry-content',
      '.main-content',
      '#primary',
    ]

    for (const selector of selectors) {
      const node = doc.querySelector(selector)
      if (node && this.cleanText(node.textContent || '').length > 200) {
        return node
      }
    }

    return doc.body || null
  }

  private splitPlainTextIntoSegments(text: string): ContentSegment[] {
    if (!text) {
      return []
    }

    const sentences = text
      .split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ])/)
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 0)

    if (sentences.length === 0) {
      return []
    }

    const segments: ContentSegment[] = []
    let buffer = ''

    sentences.forEach(sentence => {
      if ((buffer + ' ' + sentence).trim().length > 220) {
        segments.push({ text: buffer.trim(), tag: 'p' })
        buffer = sentence
      } else {
        buffer = (buffer ? buffer + ' ' : '') + sentence
      }
    })

    if (buffer.trim().length > 0) {
      segments.push({ text: buffer.trim(), tag: 'p' })
    }

    return segments.filter(segment => segment.text.length > 40 && !this.isLowValueSegment(segment.text))
  }

  private truncateContent(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text
    }

    const truncated = text.slice(0, maxLength)
    const lastSpace = truncated.lastIndexOf(' ')
    return lastSpace > 0 ? `${truncated.slice(0, lastSpace)}...` : `${truncated}...`
  }

  private isLowValueSegment(text: string): boolean {
    const lowered = text.toLowerCase()
    return (
      lowered.includes('cookie') ||
      lowered.includes('newsletter') ||
      lowered.includes('privacy policy') ||
      lowered.includes('terms of use') ||
      lowered.includes('advertisement')
    )
  }

  /**
   * Process queued requests
   */
  private processQueue(): void {
    if (this.queue.length > 0 && this.activeRequests < this.config.maxConcurrentRequests) {
      const task = this.queue.shift()
      if (task) task()
    }
  }


  /**
   * Decode URL from DuckDuckGo format
   */
  private decodeUrl(url: string): string {
    try {
      const match = url.match(/uddg=([^&]+)/)
      if (match) {
        return decodeURIComponent(match[1])
      }
      return url
    } catch {
      return url
    }
  }

  /**
   * Clean text content
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .trim()
  }

  /**
   * Decode HTML entities
   */
  private decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
    }

    return text.replace(/&[^;]+;/g, (entity) => entities[entity] || entity)
  }

  /**
   * Get current queue status
   */
  getQueueStatus(): { active: number; queued: number } {
    return {
      active: this.activeRequests,
      queued: this.queue.length,
    }
  }
}
