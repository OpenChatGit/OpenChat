# Browser Compatibility - Puppeteer Limitation

## Problem

Puppeteer ist eine **Node.js-Library** und kann nicht direkt im Browser (Tauri Frontend) verwendet werden. Der Fehler:

```
Uncaught TypeError: Class extends value undefined is not a constructor or null
    at node_modules/agent-base/dist/index.js
```

tritt auf, weil Puppeteer Node.js-spezifische Module wie `http`, `https`, `net`, etc. verwendet, die im Browser nicht verfügbar sind.

## Aktuelle Lösung

Das Web Search Tool nutzt jetzt **fetch-basiertes Scraping**:

✅ **Browser-kompatibel**: Funktioniert in Tauri Frontend
✅ **Kein Node.js**: Nutzt nur Web-APIs
✅ **Leichtgewichtig**: Keine großen Dependencies
✅ **Schnell**: Direkte HTTP-Requests

⚠️ **Limitation**: Kein JavaScript-Rendering
⚠️ **Limitation**: Nur statisches HTML

## Zukünftige Lösungen

### Option 1: Tauri Backend Command (Empfohlen)

Puppeteer im Rust-Backend ausführen:

```rust
// src-tauri/src/main.rs
#[tauri::command]
async fn scrape_url(url: String) -> Result<String, String> {
    // Puppeteer via Node.js Child Process
    // oder Rust-basierte Browser-Automation (headless_chrome)
    Ok(content)
}
```

**Vorteile:**
- Voller Puppeteer-Support
- JavaScript-Rendering
- Sicher (Backend-only)

**Nachteile:**
- Komplexere Architektur
- Rust-Code nötig

### Option 2: Headless Chrome via Rust

Nutze `headless_chrome` Crate in Rust:

```rust
use headless_chrome::Browser;

#[tauri::command]
async fn scrape_with_chrome(url: String) -> Result<String, String> {
    let browser = Browser::default()?;
    let tab = browser.wait_for_initial_tab()?;
    tab.navigate_to(&url)?;
    let content = tab.get_content()?;
    Ok(content)
}
```

**Vorteile:**
- Nativer Rust-Code
- Kein Node.js nötig
- Performant

**Nachteile:**
- Chrome muss installiert sein
- Rust-Kenntnisse erforderlich

### Option 3: Externe Scraping API

Nutze Services wie:
- ScrapingBee
- ScraperAPI
- Bright Data

**Vorteile:**
- Einfach zu integrieren
- JavaScript-Rendering
- Keine lokale Browser-Installation

**Nachteile:**
- Kosten
- API-Keys nötig
- Externe Abhängigkeit
- Datenschutz-Bedenken

### Option 4: Hybrid-Ansatz

Fetch für einfache Seiten, Tauri-Backend für komplexe:

```typescript
async scrapeUrl(url: string): Promise<ScrapedContent> {
  // Versuche erst fetch
  const simple = await this.fetchScraper.scrape(url)
  
  // Wenn zu wenig Content, nutze Backend
  if (simple.content.length < 500) {
    return await invoke('scrape_with_browser', { url })
  }
  
  return simple
}
```

## Aktueller Status

**Implementiert**: Fetch-basiertes Scraping
**Funktioniert**: ✅ Web Search
**Funktioniert**: ✅ RAG-Prozessing
**Funktioniert**: ✅ Tool-Calls

**Nicht verfügbar**: JavaScript-Rendering
**Nicht verfügbar**: Dynamische Inhalte
**Nicht verfügbar**: SPA-Support

## Empfehlung

Für die meisten Use-Cases ist fetch-basiertes Scraping ausreichend:
- Dokumentation-Seiten
- Blogs
- Statische Websites
- Wikipedia
- Stack Overflow

Für JavaScript-heavy Sites (React/Vue/Angular SPAs) wäre ein Tauri-Backend-Command die beste Lösung.

## Migration zu Tauri-Backend (Zukünftig)

1. Erstelle Rust-Command in `src-tauri/src/main.rs`
2. Installiere `headless_chrome` Crate
3. Implementiere Scraping-Logik in Rust
4. Rufe Command von Frontend via `invoke()`
5. Fallback zu fetch wenn Backend nicht verfügbar

## Dateien

**Behalten (funktioniert)**:
- `scraper.ts` - Fetch-basiertes Scraping
- `rag.ts` - RAG-Prozessor
- `index.ts` - Main Tool
- `plugin.ts` - Plugin-Integration

**Nicht verwendet (Node.js-only)**:
- `puppeteerScraper.ts` - Nur für Node.js
- `browserFinder.ts` - Nur für Node.js
- `PUPPETEER.md` - Dokumentation für zukünftige Backend-Lösung

Diese Dateien bleiben im Repo für zukünftige Backend-Integration, werden aber aktuell nicht verwendet.
