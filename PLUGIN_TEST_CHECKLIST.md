# Plugin System Test Checklist

## Test 1: Plugins werden geladen ✓

**Erwartung:**
- Console zeigt: `[PluginLoader] Loaded 2 built-in plugins`
- Console zeigt: `[PluginManager] Plugin registered: markdown-renderer`
- Console zeigt: `[PluginManager] Plugin registered: timestamp`

**Test:**
1. App starten
2. Console öffnen (F12)
3. Nach obigen Logs suchen

## Test 2: Plugins werden in Settings angezeigt ✓

**Erwartung:**
- Settings → Plugins zeigt 2 Built-in Plugins:
  - Markdown Renderer (enabled, core)
  - Timestamp (enabled/disabled)

**Test:**
1. Settings öffnen (Zahnrad-Icon)
2. Zu "Plugins" Tab wechseln
3. Built-in Plugins Sektion aufklappen
4. Plugins sollten sichtbar sein mit Name, Version, Description

## Test 3: Hooks werden registriert ✓

**Erwartung:**
- Console zeigt: `[HooksAPI] Plugin "timestamp" registered hook: message.render.user`
- Console zeigt: `[PluginHooks] Registered hook: message.render.user for plugin: timestamp`

**Test:**
1. Nach Plugin-Laden in Console suchen
2. Logs sollten Hook-Registrierung zeigen

## Test 4: Hooks werden ausgeführt ✓

**Erwartung:**
- Unter jeder User-Message erscheint ein Timestamp
- Format: "Sent at HH:MM" (oder konfiguriert)

**Test:**
1. Neue Chat-Session erstellen
2. Message senden: "Hello, test!"
3. Unter der Message sollte Timestamp erscheinen
4. Console checken: `[PluginHookRenderer] Executing hooks for message.render.user`

## Test 5: Plugin kann aktiviert/deaktiviert werden ✓

**Erwartung:**
- Toggle in Settings funktioniert
- Wenn deaktiviert: Kein Timestamp mehr
- Wenn aktiviert: Timestamp erscheint wieder

**Test:**
1. Settings → Plugins öffnen
2. Timestamp Plugin deaktivieren
3. Neue Message senden → Kein Timestamp
4. Timestamp Plugin aktivieren
5. Neue Message senden → Timestamp erscheint

## Test 6: Plugin-Konfiguration funktioniert ✓

**Erwartung:**
- Timestamp-Plugin hat Config-Button
- Config-Panel öffnet sich
- Einstellungen können geändert werden (Format, Prefix, etc.)
- Änderungen werden gespeichert und angewendet

**Test:**
1. Settings → Plugins → Timestamp
2. "Configure" Button klicken
3. Format ändern (z.B. 12h → 24h)
4. Speichern
5. Neue Message senden → Format sollte geändert sein

## Debugging bei Problemen:

### Problem: Plugins werden nicht geladen
**Check:**
```javascript
// In Console:
console.log(window.__PLUGINS__)  // Sollte Plugin-Liste zeigen
```

**Fix:**
- `usePlugins.ts` - `loadAllPlugins()` wird aufgerufen?
- `PluginLoader.ts` - Imports funktionieren?

### Problem: Hooks werden nicht registriert
**Check:**
```javascript
// In Console:
import { pluginHooks } from './plugins/core/PluginHooks'
console.log(pluginHooks.getAll())  // Sollte registrierte Hooks zeigen
```

**Fix:**
- `onLoad()` wird aufgerufen?
- `pluginAPI` ist definiert?
- `pluginAPI.hooks.register()` wird aufgerufen?

### Problem: Hooks werden nicht ausgeführt
**Check:**
- `PluginHookRenderer` wird in ChatMessage gerendert?
- `pluginHooks.execute()` wird aufgerufen?

**Fix:**
- ChatMessage.tsx - `<PluginHookRenderer hookType="message.render.user" message={message} />`
- PluginHookRenderer.tsx - `useEffect` wird getriggert?

### Problem: pluginAPI ist undefined
**Check:**
```javascript
// Im Plugin-Code:
console.log('pluginAPI:', typeof pluginAPI)  // Sollte 'object' sein
```

**Fix:**
- PluginExecutor.ts - `pluginAPI` wird injiziert?
- Wrapped code korrekt?

## Erfolgs-Kriterien:

✅ Alle 6 Tests bestanden
✅ Keine Errors in Console
✅ Plugins funktionieren wie erwartet
✅ Performance ist gut (keine Lags)

## Nächste Schritte nach erfolgreichen Tests:

1. Session & Message APIs implementieren
2. Mehr Hook-Types hinzufügen
3. Externe Plugins testen
4. Dokumentation schreiben
5. Template-Plugin verbessern
