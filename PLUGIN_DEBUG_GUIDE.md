# Plugin System Debug Guide

## Aktueller Status

### Was wir gerade gemacht haben:

1. ✅ `usePlugins.ts` - Verwendet jetzt `pluginManager.loadAllPlugins()`
2. ✅ `PluginLoader.ts` - Lädt Built-in Plugins direkt (MarkdownRenderer, Timestamp)
3. ✅ `ChatMessage.tsx` - Rendert bereits `PluginHookRenderer` für user/assistant messages
4. ✅ Hooks werden registriert über `HooksAPI`

### Was funktionieren sollte:

1. **Plugin-Laden**: PluginManager lädt Plugins über PluginLoader
2. **Hook-Registrierung**: Plugins registrieren Hooks über `pluginAPI.hooks.register()`
3. **Hook-Ausführung**: `PluginHookRenderer` führt Hooks aus und rendert Ergebnisse

### Debugging-Schritte:

1. **Console öffnen** und nach folgenden Logs suchen:
   ```
   [usePlugins] Starting plugin initialization...
   [PluginLoader] Loading built-in plugins...
   [PluginLoader] Loaded built-in plugin: markdown-renderer
   [PluginLoader] Loaded built-in plugin: timestamp
   [usePlugins] Loaded X plugins
   ```

2. **Plugin-Registrierung prüfen**:
   ```
   [PluginManager] Plugin registered: ...
   [HooksAPI] Plugin "..." registered hook: message.render.user
   ```

3. **Hook-Ausführung prüfen**:
   ```
   [PluginHooks] Registered hook: message.render.user for plugin: ...
   [PluginHookRenderer] Executing hooks for message.render.user
   ```

### Mögliche Probleme:

1. **Plugins werden nicht geladen**
   - Check: Console-Logs von PluginLoader
   - Fix: Sicherstellen, dass Imports funktionieren

2. **Hooks werden nicht registriert**
   - Check: `onLoad()` wird aufgerufen?
   - Fix: PluginManager muss `onLoad()` aufrufen

3. **Hooks werden nicht ausgeführt**
   - Check: `PluginHookRenderer` wird gerendert?
   - Fix: Sicherstellen, dass `pluginHooks.execute()` aufgerufen wird

4. **pluginAPI ist undefined**
   - Check: Timestamp-Plugin verwendet `pluginAPI`
   - Fix: PluginExecutor muss `pluginAPI` injizieren

### Nächste Schritte:

1. App starten und Console-Logs checken
2. In Settings → Plugins schauen, ob Plugins angezeigt werden
3. Eine Message senden und schauen, ob Timestamp erscheint
4. Wenn nicht: Logs analysieren und Problem identifizieren
