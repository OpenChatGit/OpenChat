/**
 * Browser Proxy Service
 * 
 * Provides a proxy to bypass CORS restrictions and set custom User-Agent
 * Uses Tauri's HTTP client to fetch pages and serve them through the app
 */

import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

interface ProxyOptions {
  url: string
  userAgent?: string
}

interface ProxyResponse {
  content: string
  contentType: string
  statusCode: number
}

/**
 * Fetch a URL through Tauri's HTTP client (bypasses CORS)
 */
export async function fetchThroughProxy(options: ProxyOptions): Promise<ProxyResponse> {
  const { url, userAgent } = options

  try {
    console.log('[BrowserProxy] Fetching:', url)

    // Use Tauri's HTTP client which bypasses CORS
    const response = await tauriFetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      }
    })

    const content = await response.text()
    const contentType = response.headers.get('content-type') || 'text/html'

    console.log('[BrowserProxy] Success:', response.status, contentType)

    return {
      content,
      contentType,
      statusCode: response.status
    }
  } catch (error) {
    console.error('[BrowserProxy] Error fetching URL:', error)
    throw new Error(`Failed to fetch URL: ${error}`)
  }
}

/**
 * Create a data URL from HTML content
 * This allows us to load the content in an iframe without CORS issues
 */
export function createDataUrl(html: string, baseUrl: string): string {
  // Inject base tag to resolve relative URLs
  const baseTag = `<base href="${baseUrl}">`
  
  // Inject script to handle navigation
  const navigationScript = `
    <script>
      // Intercept link clicks and form submissions
      document.addEventListener('DOMContentLoaded', function() {
        // Handle link clicks
        document.addEventListener('click', function(e) {
          const link = e.target.closest('a')
          if (link && link.href) {
            e.preventDefault()
            window.parent.postMessage({ type: 'navigate', url: link.href }, '*')
          }
        })
        
        // Handle form submissions
        document.addEventListener('submit', function(e) {
          e.preventDefault()
          const form = e.target
          const url = form.action || window.location.href
          window.parent.postMessage({ type: 'navigate', url: url }, '*')
        })
      })
    </script>
  `

  // Inject into HTML
  let modifiedHtml = html
  
  // Add base tag after <head>
  if (modifiedHtml.includes('<head>')) {
    modifiedHtml = modifiedHtml.replace('<head>', `<head>${baseTag}`)
  } else if (modifiedHtml.includes('<html>')) {
    modifiedHtml = modifiedHtml.replace('<html>', `<html><head>${baseTag}</head>`)
  } else {
    modifiedHtml = `<head>${baseTag}</head>${modifiedHtml}`
  }

  // Add navigation script before </body>
  if (modifiedHtml.includes('</body>')) {
    modifiedHtml = modifiedHtml.replace('</body>', `${navigationScript}</body>`)
  } else {
    modifiedHtml += navigationScript
  }

  // Create data URL
  const encoded = encodeURIComponent(modifiedHtml)
  return `data:text/html;charset=utf-8,${encoded}`
}

/**
 * Check if we're in Tauri environment
 */
export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

/**
 * Fetch and create a proxied URL
 */
export async function getProxiedUrl(url: string, userAgent?: string): Promise<string> {
  if (!isTauriEnvironment()) {
    console.warn('[BrowserProxy] Not in Tauri environment, returning original URL')
    return url
  }

  try {
    const response = await fetchThroughProxy({ url, userAgent })
    
    if (response.statusCode !== 200) {
      throw new Error(`HTTP ${response.statusCode}`)
    }

    // Create data URL from the fetched content
    return createDataUrl(response.content, url)
  } catch (error) {
    console.error('[BrowserProxy] Failed to proxy URL:', error)
    // Fallback to original URL
    return url
  }
}
