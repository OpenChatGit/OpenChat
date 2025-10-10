# Web Search Tool - Integration Guide

## Automatische Integration

Das Web Search Tool ist bereits in OpenChat integriert und wird automatisch geladen.

## Verwendung in der KI

Die KI kann das Tool automatisch nutzen, wenn sie Web-Informationen benötigt:

```
User: "Was sind die neuesten TypeScript Features?"

AI: *verwendet web_search Tool*
Basierend auf aktuellen Web-Informationen...
```

## Manuelle Tool-Nutzung

### In React Components

```typescript
import { usePlugins } from '../hooks/usePlugins'

function MyComponent() {
  const { pluginManager } = usePlugins()
  
  const searchWeb = async (query: string) => {
    const webSearchPlugin = pluginManager.get('web-search-tool')
    
    if (webSearchPlugin) {
      const result = await webSearchPlugin.execute({
        query,
        maxResults: 5,
        format: 'text'
      })
      
      console.log(result)
    }
  }
  
  return (
    <button onClick={() => searchWeb('React best practices')}>
      Search Web
    </button>
  )
}
```

### Direkt im Code

```typescript
import { WebSearchTool } from '../global_tools/web-search'

const tool = new WebSearchTool()

const context = await tool.search({
  query: 'TypeScript generics',
  maxResults: 5
})

console.log(context.summary)
console.log(context.sources)
```

## Tool-Parameter

```typescript
interface ToolParams {
  query: string          // Suchanfrage (erforderlich)
  maxResults?: number    // Max Ergebnisse (default: 5)
  format?: 'text' | 'json'  // Ausgabeformat (default: 'text')
}
```

## Ausgabeformat

### Text-Format (default)

```markdown
# Web Search Results for: "query"

## Summary
Zusammenfassung der relevantesten Informationen...

## Relevant Information

### Source 1: https://example.com
Content chunk 1...

### Source 2: https://example.com
Content chunk 2...

## All Sources
1. https://example.com
2. https://example.com
```

### JSON-Format

```json
{
  "query": "search query",
  "summary": "Summary text...",
  "chunks": [
    {
      "content": "Relevant content...",
      "source": "https://example.com",
      "relevance": 42
    }
  ],
  "sources": [
    "https://example.com"
  ]
}
```

## Plugin-Verwaltung

### Plugin aktivieren/deaktivieren

```typescript
const { enablePlugin, disablePlugin } = usePlugins()

// Deaktivieren
await disablePlugin('web-search-tool')

// Aktivieren
await enablePlugin('web-search-tool')
```

### Cache verwalten

```typescript
const webSearchPlugin = pluginManager.get('web-search-tool')

// Cache-Statistiken
const stats = webSearchPlugin.getCacheStats()
console.log(stats) // { size: 5, keys: [...] }

// Cache leeren
webSearchPlugin.clearCache()
```

## Best Practices

1. **Rate Limiting**: Nutze das eingebaute Queue-Management
2. **Caching**: Wiederholte Anfragen werden automatisch gecached
3. **Error Handling**: Tool gibt immer ein Ergebnis zurück (auch bei Fehlern)
4. **Timeout**: Standard 10s, kann konfiguriert werden
5. **Concurrent Requests**: Max 3 parallel, verhindert Überlastung

## Troubleshooting

### Keine Ergebnisse

```typescript
const result = await tool.search({ query: 'test' })

if (result.results.length === 0) {
  console.log('Keine Ergebnisse gefunden')
  // Mögliche Gründe:
  // - DuckDuckGo Rate Limit
  // - Netzwerkfehler
  // - Timeout
}
```

### Langsame Suche

```typescript
// Reduziere maxResults
const result = await tool.search({
  query: 'test',
  maxResults: 3  // statt 5
})

// Oder erhöhe Timeout
const tool = new WebSearchTool({
  requestTimeout: 15000  // 15 Sekunden
})
```

### Cache-Probleme

```typescript
// Cache leeren wenn veraltete Daten
const plugin = pluginManager.get('web-search-tool')
plugin.clearCache()

// Oder Cache deaktivieren
const tool = new WebSearchTool({
  enableCache: false
})
```

## Erweiterungen

### Eigene Suchmaschine hinzufügen

```typescript
// In scraper.ts
async search(query: string): Promise<SearchResult[]> {
  // Eigene Implementierung
  const results = await myCustomSearch(query)
  return results
}
```

### Eigenes Relevanz-Ranking

```typescript
// In rag.ts
private rankChunksByRelevance(query: string, chunks: ContentChunk[]) {
  // Eigene Ranking-Logik
  return chunks.sort((a, b) => myRankingFunction(a, b))
}
```

### Persistenter Cache

```typescript
// Cache in LocalStorage speichern
class PersistentWebSearchTool extends WebSearchTool {
  async search(query: SearchQuery): Promise<RAGContext> {
    const cached = localStorage.getItem(query.query)
    if (cached) return JSON.parse(cached)
    
    const result = await super.search(query)
    localStorage.setItem(query.query, JSON.stringify(result))
    return result
  }
}
```
