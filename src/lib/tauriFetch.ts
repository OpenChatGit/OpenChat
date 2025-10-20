/**
 * Tauri-compatible fetch wrapper
 * 
 * In Tauri desktop apps, we use multiple fallback strategies for reliable requests.
 * This wrapper automatically uses the right implementation.
 */

// Check if we're running in Tauri
const isTauri = () => {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

// Lazy-load Tauri modules
let tauriHttp: any = null
let tauriCore: any = null

const getTauriHttp = async () => {
  if (!tauriHttp && isTauri()) {
    try {
      tauriHttp = await import('@tauri-apps/plugin-http')
    } catch (e) {
      console.warn('[TauriFetch] HTTP plugin not available')
    }
  }
  return tauriHttp
}

const getTauriCore = async () => {
  if (!tauriCore && isTauri()) {
    try {
      tauriCore = await import('@tauri-apps/api/core')
    } catch (e) {
      console.warn('[TauriFetch] Core API not available')
    }
  }
  return tauriCore
}

/**
 * Fetch wrapper that works in both browser and Tauri environments
 */
export async function tauriFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // In browser, use standard fetch
  if (!isTauri()) {
    return fetch(url, options)
  }

  // In Tauri, try multiple strategies for localhost URLs
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    // Silent mode - only log if verbose debugging is needed
    const isVerbose = false // Set to true for debugging

    if (isVerbose) console.log('[TauriFetch] Localhost detected, trying Tauri strategies for:', url)

    // Strategy 1: Try Tauri HTTP Plugin
    try {
      const http = await getTauriHttp()
      if (http && http.fetch) {
        if (isVerbose) console.log('[TauriFetch] Strategy 1: Using Tauri HTTP plugin')
        return await http.fetch(url, options)
      }
    } catch (e) {
      // Silent - expected failure when provider is not running
      if (isVerbose) console.warn('[TauriFetch] Strategy 1 failed:', e)
    }

    // Strategy 2: Try standard fetch
    try {
      if (isVerbose) console.log('[TauriFetch] Strategy 2: Using standard fetch')
      return await fetch(url, options)
    } catch (e) {
      // Silent - expected failure when provider is not running
      if (isVerbose) console.warn('[TauriFetch] Strategy 2 failed:', e)
    }

    // Strategy 3: Use Rust backend proxy
    try {
      if (isVerbose) console.log('[TauriFetch] Strategy 3: Using Rust proxy')
      const core = await getTauriCore()
      if (core && core.invoke) {
        const method = options.method || 'GET'
        const body = options.body ? String(options.body) : undefined

        const responseText = await core.invoke('proxy_http_request', {
          url,
          method,
          body
        })

        // Create a Response-like object
        return new Response(responseText, {
          status: 200,
          statusText: 'OK',
          headers: new Headers({
            'Content-Type': 'application/json'
          })
        })
      }
    } catch (e) {
      // Silent - expected failure when provider is not running
      if (isVerbose) console.error('[TauriFetch] Strategy 3 failed:', e)
    }

    // All strategies failed - this is expected when provider is not running
    throw new Error('Provider not reachable')
  }

  // For non-localhost URLs, use standard fetch
  console.log('[TauriFetch] Using standard fetch for:', url)
  return fetch(url, options)
}

/**
 * Check if Tauri environment is available
 */
export function isTauriEnvironment(): boolean {
  return isTauri()
}
