// Web Search Helper - Automatische Suche vor KI-Antwort

import { WebSearchTool } from '../plugins/core/web-search'

/**
 * Prüft ob eine Frage Web Search benötigt
 */
export function shouldUseWebSearch(query: string): boolean {
  const lowerQuery = query.toLowerCase()
  
  // Starke Indikatoren - fast immer Web Search nötig
  const strongIndicators = [
    // Explizite Web-Suche (HÖCHSTE PRIORITÄT)
    'search the web', 'search web', 'suche im web', 'web search',
    'google', 'google for', 'google nach', 'googel',
    'suche nach', 'search for', 'finde im internet', 'find on the web',
    'look up', 'schau nach', 'recherchiere',
    
    // Zeit & Aktualität
    'aktuell', 'current', 'latest', 'neueste', 'newest', 'recent', 'neue',
    'heute', 'today', 'jetzt', 'now', 'gerade', 'momentan',
    'gestern', 'yesterday', 'morgen', 'tomorrow',
    
    // Preis & Kosten
    'was kostet', 'preis', 'price', 'cost', 'kosten',
    'wie teuer', 'how much', 'wie viel kostet',
    
    // Zeit & Datum
    'zeit', 'time', 'uhrzeit', 'datum', 'date',
    'wann', 'when', 'um wie viel uhr',
    
    // Wetter
    'wetter', 'weather', 'temperatur', 'temperature',
    
    // Nachrichten & Events
    'nachrichten', 'news', 'ereignis', 'event',
    
    // Jahreszahlen (aktuelle und nahe Zukunft)
    '2024', '2025', '2026',
  ]
  
  // Frage-Patterns die oft Web Search brauchen
  const questionPatterns = [
    'was ist', 'what is', 'what are', 'was sind',
    'wer ist', 'who is', 'wer sind',
    'wie viel', 'how much', 'how many',
    'wo ist', 'where is', 'wo sind',
    'gibt es', 'is there', 'are there',
  ]
  
  // Prüfe auf starke Indikatoren
  const hasStrongIndicator = strongIndicators.some(keyword => 
    lowerQuery.includes(keyword)
  )
  
  // Prüfe auf Frage-Pattern
  const hasQuestionPattern = questionPatterns.some(pattern => 
    lowerQuery.includes(pattern)
  )
  
  // Wenn starker Indikator ODER (Frage-Pattern + längere Frage)
  return hasStrongIndicator || (hasQuestionPattern && lowerQuery.length > 15)
}

/**
 * Extrahiert optimale Suchquery aus User-Frage
 */
export function extractSearchQuery(userQuery: string): string {
  let query = userQuery.trim()
  
  // Entferne höfliche Formulierungen
  query = query
    .replace(/^(kannst du|könntest du|bitte|please|can you|could you|würdest du|would you)\s+/gi, '')
    .replace(/^(sag mir|tell me|zeig mir|show me|erkläre mir|explain)\s+/gi, '')
  
  // Entferne Fragezeichen am Ende
  query = query.replace(/\?+$/g, '')
  
  // Optimiere für Suchmaschinen
  // "Was ist die aktuelle Zeit in Deutschland" → "aktuelle Zeit Deutschland"
  // "Wie viel kostet ein Tesla" → "Tesla Preis"
  
  // Wenn Frage mit "was ist" beginnt, entferne es
  query = query.replace(/^(was ist|what is|was sind|what are)\s+/gi, '')
  
  // Wenn "wie viel kostet", ersetze mit Preis
  if (/wie viel kostet|how much|was kostet/i.test(query)) {
    query = query
      .replace(/wie viel kostet|how much (does|is)|was kostet/gi, '')
      .trim() + ' Preis'
  }
  
  // Wenn "aktuelle Zeit", optimiere
  if (/zeit|time|uhrzeit/i.test(query)) {
    query = query.replace(/die\s+/gi, '').replace(/in\s+/gi, '')
  }
  
  return query.trim()
}

/**
 * Führt Web Search aus und formatiert Ergebnisse
 */
export async function performWebSearch(
  userQuery: string,
  webSearchEnabled: boolean
): Promise<string | null> {
  if (!webSearchEnabled) {
    console.log('❌ Web Search disabled')
    return null
  }
  
  const shouldSearch = shouldUseWebSearch(userQuery)
  console.log('🔍 Checking if web search needed:', {
    query: userQuery,
    shouldSearch,
  })
  
  if (!shouldSearch) {
    console.log('⏭️ No web search needed for this query')
    return null
  }
  
  try {
    console.log('✅ Starting web search...')
    console.log('📝 Original query:', userQuery)
    
    const searchQuery = extractSearchQuery(userQuery)
    console.log('🎯 Optimized search query:', searchQuery)
    
    const searchTool = new WebSearchTool({
      maxConcurrentRequests: 3,
      requestTimeout: 30000,
      maxResultsPerQuery: 5,
    })
    
    console.log('🌐 Searching DuckDuckGo...')
    const context = await searchTool.search({
      query: searchQuery,
      maxResults: 5,
    })
    
    if (!context || context.results.length === 0) {
      console.log('❌ No web search results found')
      return null
    }
    
    console.log('📊 Search results:', {
      resultsCount: context.results.length,
      chunksCount: context.relevantChunks.length,
      sourcesCount: context.sources.length,
    })
    
    // Formatiere Ergebnisse für KI
    let formattedContext = '# Web Search Results\n\n'
    formattedContext += `Query: "${searchQuery}"\n\n`
    formattedContext += `## Summary\n${context.summary}\n\n`
    
    if (context.relevantChunks.length > 0) {
      formattedContext += `## Relevant Information\n\n`
      context.relevantChunks.slice(0, 5).forEach((chunk, i) => {
        formattedContext += `### Source ${i + 1}: ${chunk.source}\n`
        formattedContext += `${chunk.content}\n\n`
      })
    }
    
    formattedContext += `## All Sources\n`
    context.sources.forEach((source, i) => {
      formattedContext += `${i + 1}. ${source}\n`
    })
    
    await searchTool.cleanup()
    
    console.log('✅ Web search completed successfully!')
    console.log('📄 Context length:', formattedContext.length, 'characters')
    return formattedContext
    
  } catch (error) {
    console.error('Web search error:', error)
    return null
  }
}
