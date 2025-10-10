# Web Search UI Integration

## Toggle Button im Chat Input

Der Web Search Toggle-Button wurde erfolgreich in den Chat Input integriert.

### Position
- **Links unten** im Input Container
- Neben dem Model Selector und Send Button

### Design
- **Icon**: `faGlobe` (Font Awesome Globe Icon)
- **Größe**: 32x32px (w-8 h-8)
- **Form**: Rund (rounded-full)
- **Hover-Effekt**: Leichter weißer Hintergrund (`hover:bg-white/10`)

### Farben
- **Aktiv (Web Search eingeschaltet)**: Blau `#3B82F6`
- **Inaktiv (Web Search ausgeschaltet)**: Weiß `#FFFFFF`
- **Transition**: Sanfter Farbübergang (`transition-colors`)

### Funktionalität

```typescript
// State in App.tsx
const [webSearchEnabled, setWebSearchEnabled] = useState(false)

// Toggle-Funktion
onToggleWebSearch={() => setWebSearchEnabled(!webSearchEnabled)}
```

### Komponenten-Hierarchie

```
App.tsx
  └─ webSearchEnabled (State)
      └─ ChatArea.tsx
          └─ ChatInput.tsx
              └─ Web Search Toggle Button
```

### Verwendung

1. **Klick auf Globe Icon**: Aktiviert/Deaktiviert Web Search
2. **Visuelles Feedback**: Icon wird blau wenn aktiv
3. **Tooltip**: Zeigt aktuellen Status an

### Code-Beispiel

```tsx
<button
  type="button"
  onClick={onToggleWebSearch}
  className="w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0 hover:bg-white/10"
  title={webSearchEnabled ? 'Web Search aktiviert' : 'Web Search deaktiviert'}
>
  <FontAwesomeIcon 
    icon={faGlobe} 
    className="w-4 h-4 transition-colors"
    style={{ 
      color: webSearchEnabled ? '#3B82F6' : '#FFFFFF'
    }}
  />
</button>
```

### Nächste Schritte

Um die Web Search Funktionalität vollständig zu integrieren:

1. **Message Processing**: Wenn `webSearchEnabled === true`, führe Web Search vor dem Senden aus
2. **Context Injection**: Füge die Suchergebnisse als Kontext zur Nachricht hinzu
3. **Loading State**: Zeige Ladeindikator während der Suche
4. **Error Handling**: Behandle Fehler bei der Suche graceful

### Beispiel-Integration in useChat Hook

```typescript
const handleSendMessage = async (content: string) => {
  if (!selectedProvider || !selectedModel || !currentSession) return
  
  let enhancedContent = content
  
  // Web Search wenn aktiviert
  if (webSearchEnabled) {
    const webSearchPlugin = pluginManager.get('web-search-tool')
    if (webSearchPlugin) {
      const searchResults = await webSearchPlugin.execute({
        query: content,
        maxResults: 5,
        format: 'text'
      })
      
      // Füge Kontext zur Nachricht hinzu
      enhancedContent = `${content}\n\n[Web Search Context]\n${searchResults}`
    }
  }
  
  await sendMessage(enhancedContent, selectedProvider, selectedModel)
}
```

### Styling-Details

- **Container**: `#2C2C2E` (Dunkelgrau)
- **Button Hover**: `rgba(255, 255, 255, 0.1)`
- **Active Color**: `#3B82F6` (Tailwind Blue-500)
- **Inactive Color**: `#FFFFFF` (Weiß)
- **Transition**: `transition-all` für sanfte Animationen
