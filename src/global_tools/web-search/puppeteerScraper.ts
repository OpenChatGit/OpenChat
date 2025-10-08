// Puppeteer-based Web Scraper with Headless Browser

import puppeteer from 'puppeteer-core'
import type { Browser } from 'puppeteer-core'
import type { SearchResult, ScrapedContent, WebSearchConfig } from './types'
import { getBrowserExecutablePath, isBrowserAvailable } from './browserFinder'

export class PuppeteerScraper {
  private browser: Browser | null = null
  private queue: Array<() => Promise<void>> = []
  private activeRequests = 0
  private config: WebSearchConfig
  private browserPath: string | null = null

  constructor(config: Partial<WebSearchConfig> = {}) {
    this.config = {
      maxConcurrentRequests: config.maxConcurrentRequests || 3,
      requestTimeout: config.requestTimeout || 30000,
      maxResultsPerQuery: config.maxResultsPerQuery || 5,
      chunkSize: config.chunkSize || 1000,
      chunkOverlap: config.chunkOverlap || 200,
      enableCache: config.enableCache ?? true,
      cacheExpiry: config.cacheExpiry || 3600000,
    }
    
    this.browserPath = getBrowserExecutablePath()
  }

  /**
   * Initialize browser instance
   */
  private async initBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser
    }

    if (!this.browserPath) {
      throw new Error('No browser found. Please install Chrome, Edge, or Chromium.')
    }

    console.log('Launching headless browser:', this.browserPath)

    this.browser = await puppeteer.launch({
      executablePath: this.browserPath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    })

    console.log('Browser launched successfully')
    return this.browser
  }

  /**
   * Close browser instance
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      console.log('Browser closed')
    }
  }

  /**
   * Check if browser is available
   */
  isBrowserAvailable(): boolean {
    return isBrowserAvailable()
  }

  /**
   * Search using DuckDuckGo with Puppeteer
   */
  async search(query: string, maxResults?: number): Promise<SearchResult[]> {
    const limit = maxResults || this.config.maxResultsPerQuery

    try {
      const browser = await this.initBrowser()
      const page = await browser.newPage()

      // Set user agent
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      )

      // Navigate to DuckDuckGo
      const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: this.config.requestTimeout,
      })

      // Wait for results to load
      await page.waitForSelector('[data-testid="result"]', {
        timeout: 5000,
      }).catch(() => {
        console.log('No results selector found, continuing...')
      })

      // Extract search results
      const results = await page.evaluate((maxCount) => {
        const resultElements = document.querySelectorAll('[data-testid="result"]')
        const extracted: Array<{ title: string; url: string; snippet: string }> = []

        for (let i = 0; i < Math.min(resultElements.length, maxCount); i++) {
          const element = resultElements[i]
          
          const titleEl = element.querySelector('h2 a, h3 a')
          const snippetEl = element.querySelector('[data-result="snippet"]')
          
          const title = titleEl?.textContent?.trim() || ''
          const url = titleEl?.getAttribute('href') || ''
          const snippet = snippetEl?.textContent?.trim() || ''

          if (title && url) {
            extracted.push({ title, url, snippet })
          }
        }

        return extracted
      }, limit)

      await page.close()

      return results.map(r => ({
        ...r,
        timestamp: Date.now(),
      }))
    } catch (error) {
      console.error('Puppeteer search error:', error)
      return []
    }
  }

  /**
   * Scrape content from URL with Puppeteer
   */
  async scrapeUrl(url: string): Promise<ScrapedContent | null> {
    return new Promise((resolve) => {
      const task = async () => {
        try {
          this.activeRequests++
          const content = await this.scrapeWithPuppeteer(url)
          resolve(content)
        } catch (error) {
          console.error(`Failed to scrape ${url}:`, error)
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
   * Scrape multiple URLs
   */
  async scrapeMultiple(urls: string[]): Promise<ScrapedContent[]> {
    const promises = urls.map(url => this.scrapeUrl(url))
    const results = await Promise.all(promises)
    return results.filter((r): r is ScrapedContent => r !== null)
  }

  /**
   * Scrape content using Puppeteer
   */
  private async scrapeWithPuppeteer(url: string): Promise<ScrapedContent> {
    const browser = await this.initBrowser()
    const page = await browser.newPage()

    try {
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      )

      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.config.requestTimeout,
      })

      // Extract main content
      const data = await page.evaluate(() => {
        // Remove unwanted elements
        const unwanted = document.querySelectorAll('script, style, nav, header, footer, aside, iframe, noscript')
        unwanted.forEach(el => el.remove())

        // Get title
        const title = document.title || document.querySelector('h1')?.textContent || ''

        // Get main content
        const main = document.querySelector('main, article, [role="main"]') || document.body
        const content = main?.textContent || ''

        return {
          title: title.trim(),
          content: content.replace(/\s+/g, ' ').trim(),
        }
      })

      await page.close()

      return {
        url,
        title: data.title,
        content: data.content,
        metadata: {
          scrapedAt: Date.now(),
          contentLength: data.content.length,
        },
      }
    } catch (error) {
      await page.close()
      throw error
    }
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
   * Get queue status
   */
  getQueueStatus(): { active: number; queued: number } {
    return {
      active: this.activeRequests,
      queued: this.queue.length,
    }
  }
}
