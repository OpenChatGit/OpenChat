# Web Search Tool

Ein modulares Web Search Tool mit RAG (Retrieval-Augmented Generation) für OpenChat.

## Features

- 🔍 **Web-Suche ohne API-Keys**: Nutzt DuckDuckGo HTML-Suche
- 🚀 **Queue-Management**: Verhindert Überlastung durch intelligente Request-Warteschlange
- 📚 **RAG-Integration**: Verarbeitet Suchergebnisse zu relevantem Kontext für die KI
- 💾 **Caching**: Reduziert redundante Anfragen (1 Stunde Cache)
- ⚡ **Concurrent Scraping**: Bis zu 3 parallele Requests
- 🎯 **Relevanz-Ranking**: Intelligente Auswahl der relevantesten Inhalte

## Architektur

```
web-search/
├── types.ts          # TypeScript Definitionen
├── scraper.ts        # Web Scraper mit Queue-Management
├── rag.ts            # RAG-Prozessor für Kontext-Verarbeitung
├── index.ts          # Hauptklasse WebSearchTool
├── plugin.ts         # Plugin-Integration
└── README.md         # Diese Datei
```

## Verwendung

### Als Plugin

Das Tool ist automatisch als Plugin verfügbar:

```typescript
// Das Plugin wird automatisch geladen
// Verwendung in der KI:
"Suche im Web nach: 'Latest TypeScript features'"
```

### Programmatisch

```typescript
import { WebSearchTool } from './global_tools/web-search'

const searchTool = new WebSearchTool({
  maxConcurrentRequests: 3,
  requestTimeout: 10000,
  maxResultsPerQuery: 5,
})

// Suche durchführen
const context = await searchTool.search({
  query: 'TypeScript best practices',
  maxResults: 5,
})

// Formatiert für KI
const formatted = await searchTool.searchAndFormat(
  { query: 'TypeScript best practices' },
  'text'
)
```

## Konfiguration

```typescript
interface WebSearchConfig {
  maxConcurrentRequests: number  // Max parallele Requests (default: 3)
  requestTimeout: number          // Timeout in ms (default: 10000)
  maxResultsPerQuery: number      // Max Suchergebnisse (default: 5)
  chunkSize: number              // Chunk-Größe für RAG (default: 1000)
  chunkOverlap: number           // Chunk-Überlappung (default: 200)
  enableCache: boolean           // Cache aktivieren (default: true)
  cacheExpiry: number            // Cache-Dauer in ms (default: 3600000)
}
```

## RAG-Prozess

1. **Web-Suche**: Sucht nach relevanten Seiten
2. **Content Scraping**: Lädt Inhalte der Top-Ergebnisse
3. **Chunking**: Teilt Inhalte in überlappende Chunks
4. **Relevanz-Ranking**: Bewertet Chunks nach Relevanz zur Anfrage
5. **Kontext-Generierung**: Erstellt strukturierten Kontext für die KI

## Queue-Management

Das System verhindert Überlastung durch:

- **Concurrent Limit**: Max 3 parallele Requests
- **Request Queue**: Warteschlange für zusätzliche Requests
- **Timeout Protection**: Automatischer Abbruch nach 10s
- **Error Handling**: Graceful degradation bei Fehlern

## Beispiel-Output

```markdown
# Web Search Results for: "TypeScript best practices"

## Summary
TypeScript is a typed superset of JavaScript that compiles to plain JavaScript...

## Relevant Information

### Source 1: https://example.com/typescript-guide
TypeScript provides static typing, interfaces, and modern JavaScript features...

### Source 2: https://example.com/best-practices
When writing TypeScript code, always enable strict mode...

## All Sources
1. https://example.com/typescript-guide
2. https://example.com/best-practices
3. https://example.com/typescript-tips
```

## Performance

- **Cache Hit**: ~0ms (sofortige Antwort)
- **Cache Miss**: ~2-5s (abhängig von Netzwerk und Seitenanzahl)
- **Concurrent Requests**: 3 parallele Scrapes
- **Memory**: ~5-10MB pro Suche (mit Cache)

## Limitierungen

- Keine JavaScript-Rendering (nur statisches HTML)
- DuckDuckGo Rate Limits können greifen
- Einfaches Keyword-Matching für Relevanz (kein ML)
- Keine Unterstützung für dynamische Inhalte

## Zukünftige Erweiterungen

- [ ] Puppeteer-Integration für JS-Rendering
- [ ] Embedding-basiertes Relevanz-Ranking
- [ ] Mehrere Suchmaschinen-Backends
- [ ] Persistenter Cache (IndexedDB/LocalStorage)
- [ ] Bild- und Video-Suche
- [ ] PDF-Extraktion
