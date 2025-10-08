# Global Tools

Globale Tools sind für alle Benutzer verfügbar und werden automatisch geladen.

## Verfügbare Tools

### Web Search
- **Pfad**: `web-search/`
- **Beschreibung**: Web-Suche mit RAG (Retrieval-Augmented Generation)
- **Features**: DuckDuckGo-Suche, Content Scraping, intelligentes Chunking, Relevanz-Ranking
- **Status**: ✅ Aktiv

## Tool-Struktur

Jedes Tool sollte folgende Struktur haben:

```
tool-name/
├── types.ts          # TypeScript Definitionen
├── index.ts          # Hauptlogik
├── plugin.ts         # Plugin-Integration
└── README.md         # Dokumentation
```

## Neues Tool hinzufügen

1. Erstelle Verzeichnis in `global_tools/`
2. Implementiere Tool-Logik
3. Erstelle Plugin-Wrapper (`plugin.ts`)
4. Registriere in `usePlugins.ts`
5. Dokumentiere in README.md

## Best Practices

- **Modular**: Jedes Tool ist unabhängig
- **Queue-Management**: Verhindere Überlastung
- **Caching**: Reduziere redundante Anfragen
- **Error Handling**: Graceful degradation
- **TypeScript**: Vollständige Typisierung
