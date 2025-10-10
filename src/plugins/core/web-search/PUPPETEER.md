# Puppeteer Integration - Headless Browser

## Übersicht

Das Web Search Tool nutzt **puppeteer-core** für echtes Browser-Rendering im Hintergrund. Es verwendet den bereits installierten Browser des Users (Chrome, Edge oder Chromium) ohne zusätzliche Downloads.

## Features

✅ **Kein Chrome-Download**: Nutzt puppeteer-core (nur ~2MB statt ~300MB)
✅ **User's Browser**: Verwendet Chrome/Edge/Chromium vom System
✅ **Headless Mode**: Läuft komplett im Hintergrund
✅ **JavaScript Support**: Rendert dynamische Inhalte
✅ **Fallback**: Nutzt fetch wenn kein Browser gefunden wird

## Architektur

```
WebSearchTool
    │
    ├─ Browser verfügbar?
    │   │
    │   ├─ JA → PuppeteerScraper (headless browser)
    │   │       ├─ Findet Chrome/Edge/Chromium
    │   │       ├─ Startet headless
    │   │       └─ Scraped mit JS-Rendering
    │   │
    │   └─ NEIN → WebScraper (fetch fallback)
    │           └─ Einfaches HTML-Parsing
    │
    └─ RAG Processor (beide nutzen gleichen Prozessor)
```

## Browser-Finder

### Unterstützte Browser

1. **Google Chrome**
   - `C:\Program Files\Google\Chrome\Application\chrome.exe`
   - `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`
   - `%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe`

2. **Microsoft Edge**
   - `C:\Program Files\Microsoft\Edge\Application\msedge.exe`
   - `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`

3. **Chromium**
   - `%LOCALAPPDATA%\Chromium\Application\chrome.exe`

### Priorität

1. Chrome (bevorzugt)
2. Edge (zweite Wahl)
3. Chromium (dritte Wahl)

## Puppeteer-Konfiguration

### Browser-Launch-Optionen

```typescript
{
  executablePath: browserPath,
  headless: true,  // Komplett unsichtbar
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--window-size=1920,1080',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process',
  ]
}
```

### Timeouts

- **Navigation**: 30 Sekunden
- **Selector Wait**: 5 Sekunden
- **Network Idle**: Automatisch

## Verwendung

### Automatische Auswahl

```typescript
import { WebSearchTool } from './global_tools/web-search'

// Wählt automatisch Puppeteer wenn Browser verfügbar
const tool = new WebSearchTool()

const results = await tool.search({
  query: 'TypeScript best practices',
  maxResults: 5
})
```

### Manuell Puppeteer nutzen

```typescript
import { PuppeteerScraper } from './global_tools/web-search'

const scraper = new PuppeteerScraper({
  maxConcurrentRequests: 3,
  requestTimeout: 30000,
})

const results = await scraper.search('React hooks', 5)
const content = await scraper.scrapeUrl('https://example.com')

// Cleanup
await scraper.closeBrowser()
```

### Browser-Verfügbarkeit prüfen

```typescript
import { isBrowserAvailable, getBrowserExecutablePath } from './global_tools/web-search'

if (isBrowserAvailable()) {
  console.log('Browser found:', getBrowserExecutablePath())
} else {
  console.log('No browser found, using fetch fallback')
}
```

## Vorteile von Puppeteer

### Mit Puppeteer (Browser verfügbar)
✅ JavaScript-Rendering
✅ Dynamische Inhalte
✅ AJAX-Requests werden geladen
✅ Single-Page-Apps funktionieren
✅ Bessere Selektoren
✅ Screenshots möglich (zukünftig)

### Ohne Puppeteer (Fallback)
⚠️ Nur statisches HTML
⚠️ Kein JavaScript
⚠️ Keine dynamischen Inhalte
✅ Schneller
✅ Weniger Ressourcen

## Performance

### Puppeteer
- **Startup**: ~2-3 Sekunden (erster Start)
- **Pro Seite**: ~3-5 Sekunden
- **Memory**: ~100-200MB (Browser-Prozess)
- **Parallel**: 3 Tabs gleichzeitig

### Fetch (Fallback)
- **Startup**: Sofort
- **Pro Seite**: ~0.5-1 Sekunde
- **Memory**: ~10-20MB
- **Parallel**: Unbegrenzt

## Cleanup

Browser wird automatisch geschlossen:
- Bei `onUnload()` des Plugins
- Bei Fehler (automatisch)
- Manuell via `cleanup()`

```typescript
// Manuelles Cleanup
const tool = new WebSearchTool()
// ... Nutzung ...
await tool.cleanup()
```

## Debugging

### Console-Ausgaben

```
// Browser gefunden
"Using Puppeteer scraper (headless browser)"
"Launching headless browser: C:\Program Files\Google\Chrome\Application\chrome.exe"
"Browser launched successfully"

// Kein Browser
"Using fetch scraper (no browser found)"
```

### Häufige Probleme

**Problem**: "No browser found"
- **Lösung**: Installiere Chrome, Edge oder Chromium

**Problem**: Browser startet nicht
- **Lösung**: Prüfe ob Browser-Pfad korrekt ist
- **Lösung**: Prüfe Berechtigungen

**Problem**: Timeout beim Scraping
- **Lösung**: Erhöhe `requestTimeout` in Config
- **Lösung**: Seite lädt zu langsam, nutze fetch-Fallback

**Problem**: Zu viel Memory
- **Lösung**: Reduziere `maxConcurrentRequests`
- **Lösung**: Schließe Browser nach jeder Suche

## Erweiterungen

### Screenshots (zukünftig)

```typescript
async takeScreenshot(url: string): Promise<Buffer> {
  const browser = await this.initBrowser()
  const page = await browser.newPage()
  await page.goto(url)
  const screenshot = await page.screenshot()
  await page.close()
  return screenshot
}
```

### PDF-Export (zukünftig)

```typescript
async exportPDF(url: string): Promise<Buffer> {
  const browser = await this.initBrowser()
  const page = await browser.newPage()
  await page.goto(url)
  const pdf = await page.pdf()
  await page.close()
  return pdf
}
```

### Custom Scripts (zukünftig)

```typescript
async executeScript(url: string, script: string): Promise<any> {
  const browser = await this.initBrowser()
  const page = await browser.newPage()
  await page.goto(url)
  const result = await page.evaluate(script)
  await page.close()
  return result
}
```

## Sicherheit

- **Headless Mode**: Kein sichtbares Fenster
- **No Sandbox**: Für Tauri-Kompatibilität
- **Disable Web Security**: Für CORS-Probleme
- **User Agent**: Sieht aus wie normaler Browser

## Best Practices

1. **Browser wiederverwenden**: Nicht für jede Suche neu starten
2. **Cleanup**: Immer Browser schließen wenn fertig
3. **Timeouts**: Angemessene Timeouts setzen
4. **Concurrent Limit**: Max 3 parallele Tabs
5. **Error Handling**: Immer try-catch verwenden
6. **Fallback**: Fetch als Backup bereithalten

## Tauri-Integration

Puppeteer funktioniert in Tauri-Apps:
- Browser läuft als separater Prozess
- Keine Sandbox-Probleme
- Headless Mode funktioniert
- Cleanup wichtig für Memory-Management
