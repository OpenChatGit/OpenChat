// Web Search Tool - Beispiel-Nutzung

import { WebSearchTool } from './index'

/**
 * Beispiel 1: Einfache Suche
 */
async function simpleSearch() {
  const tool = new WebSearchTool()

  const result = await tool.searchAndFormat(
    { query: 'TypeScript best practices 2024' },
    'text'
  )

  console.log(result)
}

/**
 * Beispiel 2: Suche mit benutzerdefinierten Einstellungen
 */
async function customSearch() {
  const tool = new WebSearchTool({
    maxConcurrentRequests: 5,
    requestTimeout: 15000,
    maxResultsPerQuery: 10,
    chunkSize: 1500,
    chunkOverlap: 300,
  })

  const context = await tool.search({
    query: 'React Server Components tutorial',
    maxResults: 10,
  })

  console.log('Query:', context.query)
  console.log('Results found:', context.results.length)
  console.log('Relevant chunks:', context.relevantChunks.length)
  console.log('Sources:', context.sources)
  console.log('\nSummary:')
  console.log(context.summary)
}

/**
 * Beispiel 3: JSON-Format für strukturierte Daten
 */
async function jsonSearch() {
  const tool = new WebSearchTool()

  const result = await tool.searchAndFormat(
    { query: 'Latest AI developments' },
    'json'
  )

  const data = JSON.parse(result)
  console.log('Parsed data:', data)
}

/**
 * Beispiel 4: Cache-Verwaltung
 */
async function cacheManagement() {
  const tool = new WebSearchTool()

  // Erste Suche (wird gecached)
  console.time('First search')
  await tool.search({ query: 'Node.js performance tips' })
  console.timeEnd('First search')

  // Zweite Suche (aus Cache)
  console.time('Cached search')
  await tool.search({ query: 'Node.js performance tips' })
  console.timeEnd('Cached search')

  // Cache-Statistiken
  const stats = tool.getCacheStats()
  console.log('Cache stats:', stats)

  // Cache leeren
  tool.clearCache()
  console.log('Cache cleared')
}

/**
 * Beispiel 5: Queue-Status überwachen
 */
async function monitorQueue() {
  const tool = new WebSearchTool({
    maxConcurrentRequests: 2,
  })

  // Mehrere Suchen gleichzeitig starten
  const searches = [
    'JavaScript frameworks',
    'Python data science',
    'Rust programming',
    'Go concurrency',
    'Kotlin coroutines',
  ]

  const promises = searches.map(query => 
    tool.search({ query, maxResults: 3 })
  )

  // Status während der Verarbeitung
  const interval = setInterval(() => {
    const status = tool.getQueueStatus()
    console.log(`Active: ${status.active}, Queued: ${status.queued}`)
  }, 500)

  await Promise.all(promises)
  clearInterval(interval)

  console.log('All searches completed')
}

/**
 * Beispiel 6: Error Handling
 */
async function errorHandling() {
  const tool = new WebSearchTool({
    requestTimeout: 1000, // Sehr kurzes Timeout für Demo
  })

  try {
    const result = await tool.search({
      query: 'test query',
      maxResults: 5,
    })

    if (result.results.length === 0) {
      console.log('No results found or search failed')
    } else {
      console.log('Search successful:', result.results.length, 'results')
    }
  } catch (error) {
    console.error('Search error:', error)
  }
}

// Beispiele ausführen (auskommentiert, um nicht automatisch zu laufen)
// simpleSearch()
// customSearch()
// jsonSearch()
// cacheManagement()
// monitorQueue()
// errorHandling()
