# Tool Call System - Vollständige Dokumentation

## Übersicht

Das Tool-Call-System ermöglicht es KI-Modellen, externe Tools wie Web Search zu nutzen. Das System ist vollständig modular und wartet auf die Ausführung von Tools, bevor es die finale Antwort generiert.

## Architektur

```
┌─────────────────────────────────────────────────────────────┐
│                         User Input                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              useChatWithTools Hook                          │
│  - Verwaltet Web Search Toggle State                       │
│  - Koordiniert Tool-Ausführung                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              System Prompt Generator                        │
│  - Erstellt Prompt mit Tool-Definitionen                   │
│  - Erklärt KI wie Tool-Calls funktionieren                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   AI Model Response                         │
│  - Generiert Tool-Call JSON wenn nötig                     │
│  - Oder antwortet direkt                                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
                 Tool-Call?
                   /    \
                 Ja      Nein
                 │        │
                 ▼        ▼
┌──────────────────────┐  ┌────────────────┐
│   Tool Executor      │  │ Zeige Antwort  │
│ - Führt Tools aus    │  └────────────────┘
│ - Wartet auf Ergebnis│
└──────────┬───────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│              Tool Results als Context                       │
│  - Fügt Ergebnisse zur Konversation hinzu                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│           AI Final Response mit Tool-Daten                  │
│  - Nutzt Tool-Ergebnisse für finale Antwort                │
└─────────────────────────────────────────────────────────────┘
```

## Komponenten

### 1. Types (`src/types/tools.ts`)

Definiert alle Tool-Call-bezogenen TypeScript-Typen:
- `ToolCall` - Tool-Aufruf vom KI-Modell
- `ToolCallResult` - Ergebnis der Tool-Ausführung
- `ToolDefinition` - Tool-Definition für System-Prompt
- `MessageWithToolCalls` - Erweiterte Message mit Tool-Calls

### 2. Tool Executor (`src/lib/toolExecutor.ts`)

Führt Tool-Calls aus:
- `getAvailableTools()` - Holt alle verfügbaren Tools vom PluginManager
- `executeToolCall()` - Führt einen einzelnen Tool-Call aus
- `executeToolCalls()` - Führt mehrere Tool-Calls parallel aus
- `formatToolResultsForAI()` - Formatiert Ergebnisse für KI

### 3. System Prompts (`src/lib/systemPrompts.ts`)

Generiert System-Prompts für KI-Modelle:
- `generateSystemPrompt()` - Erstellt Prompt mit Tool-Definitionen
- `parseToolCalls()` - Parst Tool-Calls aus KI-Antwort
- `hasToolCalls()` - Prüft ob Antwort Tool-Calls enthält
- `createToolResultMessage()` - Erstellt Tool-Result-Message

### 4. Enhanced Chat Hook (`src/hooks/useChatWithTools.ts`)

Erweiterte Version von `useChat` mit Tool-Support:
- Verwaltet `webSearchEnabled` State
- Führt Tool-Calls automatisch aus
- Wartet auf Tool-Ergebnisse
- Generiert finale Antwort mit Tool-Daten

## Tool-Call-Format

### KI-Modell sendet Tool-Call:

```json
{
  "tool_calls": [
    {
      "id": "call_abc123",
      "type": "function",
      "function": {
        "name": "web_search",
        "arguments": "{\"query\": \"TypeScript best practices\", \"maxResults\": 5}"
      }
    }
  ]
}
```

### System führt Tool aus und sendet Ergebnis:

```
Tool execution result (ID: call_abc123):

# Web Search Results for: "TypeScript best practices"

## Summary
TypeScript is a typed superset of JavaScript...

## Relevant Information
...
```

### KI-Modell nutzt Ergebnis für finale Antwort:

```
Based on the web search results, here are the TypeScript best practices:

1. Enable strict mode...
2. Use interfaces...
...

Sources:
- https://example.com/typescript-guide
```

## Verwendung

### In App.tsx integrieren:

```typescript
import { useChatWithTools } from './hooks/useChatWithTools'

function App() {
  const { pluginManager } = usePlugins()
  
  const {
    sessions,
    currentSession,
    isGenerating,
    webSearchEnabled,
    setWebSearchEnabled,
    sendMessage,
    // ...
  } = useChatWithTools(pluginManager)
  
  return (
    <ChatArea
      webSearchEnabled={webSearchEnabled}
      onToggleWebSearch={() => setWebSearchEnabled(!webSearchEnabled)}
      // ...
    />
  )
}
```

### Web Search aktivieren:

1. User klickt auf Globe-Icon (wird blau)
2. `webSearchEnabled` wird `true`
3. Bei nächster Nachricht wird System-Prompt mit Tools hinzugefügt
4. KI kann jetzt Tool-Calls machen

## Ablauf einer Tool-Call-Konversation

### 1. User fragt:
```
"Was sind die neuesten TypeScript Features?"
```

### 2. System sendet an KI:
```
System: [Tool-Definitionen und Anleitung]
User: Was sind die neuesten TypeScript Features?
```

### 3. KI antwortet mit Tool-Call:
```json
{
  "tool_calls": [{
    "id": "call_1",
    "type": "function",
    "function": {
      "name": "web_search",
      "arguments": "{\"query\": \"TypeScript latest features 2024\"}"
    }
  }]
}
```

### 4. System führt Web Search aus:
- Zeigt: "🔧 Executing 1 tool call(s)..."
- Führt Web Search aus (wartet auf Puppeteer)
- Zeigt Ergebnis als System-Message

### 5. System sendet Tool-Ergebnis an KI:
```
System: Tool execution result (ID: call_1):
[Web Search Ergebnisse]

User: Was sind die neuesten TypeScript Features?
```

### 6. KI generiert finale Antwort:
```
Basierend auf den aktuellen Web-Informationen sind die neuesten TypeScript Features:

1. Decorators (Stage 3)
2. Satisfies Operator
3. ...

Quellen:
- https://...
```

## Vorteile

✅ **Asynchron**: Wartet auf Tool-Ausführung (Puppeteer)
✅ **Modular**: Neue Tools einfach hinzufügbar
✅ **Transparent**: User sieht Tool-Ausführung
✅ **Flexibel**: KI entscheidet wann Tools nötig sind
✅ **Parallel**: Mehrere Tool-Calls gleichzeitig möglich
✅ **Provider-agnostisch**: Funktioniert mit allen KI-Modellen

## Nächste Schritte

1. **App.tsx aktualisieren**: `useChat` durch `useChatWithTools` ersetzen
2. **Testen**: Web Search Toggle aktivieren und Fragen stellen
3. **Weitere Tools**: Weitere Tools zum System hinzufügen
4. **Optimierung**: Tool-Call-Parsing verbessern für verschiedene Modelle

## Beispiel-Tools die hinzugefügt werden können

- **Calculator**: Mathematische Berechnungen
- **Weather**: Wetter-Informationen
- **Code Executor**: Code ausführen
- **File Reader**: Dateien lesen
- **Database Query**: Datenbank-Abfragen
- **API Caller**: Externe APIs aufrufen
