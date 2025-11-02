# Plugin System - Implementation Plan

## Aktueller Status

### ✅ Was funktioniert:
- Plugin-Loader (lädt Built-in und externe Plugins)
- Plugin-Manager (registriert, aktiviert/deaktiviert Plugins)
- Storage API (localStorage für Plugins)
- Config API (Konfiguration mit Schema-Validierung)
- UI API (Notifications, Modals, Toolbar-Buttons)
- Hooks API (Registrierung von Hooks)
- Security (Permissions, Approval)

### ❌ Was fehlt/nicht funktioniert:
1. **Session API** - Nicht implementiert (nur Platzhalter)
2. **Message API** - Nicht implementiert (nur Platzhalter)
3. **Hook-Ausführung** - Hooks werden registriert, aber nicht ausgeführt
4. **Global pluginAPI Injection** - Externe Plugins haben keinen Zugriff auf `pluginAPI`
5. **Hook-Integration in UI** - Hooks werden nicht in Komponenten gerendert

## Implementierungsplan

### Phase 1: Session & Message APIs implementieren ✅ PRIORITY

**Ziel:** Plugins können auf Sessions und Messages zugreifen

**Dateien:**
- `src/plugins/api/SessionAPI.ts` (neu)
- `src/plugins/api/MessageAPI.ts` (neu)
- `src/plugins/api/PluginAPI.ts` (update)

**Was brauchen wir:**
```typescript
// SessionAPI
- getCurrent(): Session | null
- getAll(): Session[]
- create(title: string): Session
- delete(id: string): void
- onSwitch(handler: (session: Session) => void): void

// MessageAPI
- send(content: string): Promise<void>
- getHistory(): Message[]
- onReceive(handler: (message: Message) => void): void
- onSend(handler: (message: Message) => void): void
```

**Integration:**
- PluginManager braucht Zugriff auf App-State (sessions, messages)
- Callbacks für Events (session switch, message receive/send)

### Phase 2: Hook-Ausführung implementieren ✅ PRIORITY

**Ziel:** Registrierte Hooks werden tatsächlich ausgeführt

**Dateien:**
- `src/components/ChatMessage.tsx` (update)
- `src/components/ChatInput.tsx` (update)
- `src/hooks/useChatWithTools.ts` (update)

**Hook-Types die wir brauchen:**
```typescript
// Message Rendering Hooks
- 'message.render.user' - Render unter User-Messages
- 'message.render.assistant' - Render unter Assistant-Messages
- 'message.render.system' - Render unter System-Messages

// Message Processing Hooks
- 'message.before.send' - Vor dem Senden (kann Message modifizieren)
- 'message.after.receive' - Nach dem Empfangen (kann Message modifizieren)

// UI Hooks
- 'ui.toolbar' - Toolbar-Buttons
- 'ui.sidebar' - Sidebar-Komponenten
- 'ui.settings' - Settings-Panel

// Session Hooks
- 'session.create' - Wenn Session erstellt wird
- 'session.delete' - Wenn Session gelöscht wird
- 'session.switch' - Wenn Session gewechselt wird
```

**Integration:**
- In ChatMessage: Hook-Renderer für message.render.*
- In ChatInput: Hook für message.before.send
- In useChatWithTools: Hook für message.after.receive

### Phase 3: Global pluginAPI Injection ✅ PRIORITY

**Ziel:** Externe Plugins haben Zugriff auf `pluginAPI` ohne Imports

**Dateien:**
- `src/plugins/core/PluginExecutor.ts` (update)
- `src/plugins/api/pluginAPI.d.ts` (update)

**Wie:**
```typescript
// Bei Plugin-Ausführung:
const pluginAPI = createPluginAPI(pluginId, manifest)

// Code mit injiziertem API ausführen:
const wrappedCode = `
  const pluginAPI = arguments[0];
  ${pluginCode}
`

const PluginClass = new Function('return ' + wrappedCode)(pluginAPI)
```

### Phase 4: Dokumentation & Beispiele

**Ziel:** Entwickler können einfach Plugins erstellen

**Dateien:**
- `PLUGIN_DEVELOPMENT_GUIDE.md` (neu)
- `src/plugins/docs/QUICK_START.md` (update)
- Template-Plugin verbessern

**Inhalt:**
- Schritt-für-Schritt Anleitung
- Alle verfügbaren Hooks mit Beispielen
- API-Referenz mit TypeScript-Typen
- Best Practices
- Debugging-Tipps

## Prioritäten

1. **HOCH:** Hook-Ausführung (Phase 2) - Ohne das funktionieren Plugins nicht
2. **HOCH:** Session & Message APIs (Phase 1) - Plugins brauchen Zugriff auf Daten
3. **MITTEL:** Global pluginAPI (Phase 3) - Macht externe Plugins einfacher
4. **NIEDRIG:** Dokumentation (Phase 4) - Wichtig, aber System muss erst funktionieren

## Nächste Schritte

1. Hook-Ausführung in ChatMessage implementieren
2. Session & Message APIs implementieren
3. Hook-Integration testen mit bestehendem Plugin
4. Dokumentation schreiben
