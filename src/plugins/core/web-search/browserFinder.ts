// Browser Finder - Findet installierte Browser auf dem System

import { existsSync } from 'fs'
import { join } from 'path'

export interface BrowserPath {
  name: string
  path: string
  type: 'chrome' | 'edge' | 'chromium'
}

/**
 * Findet installierte Browser auf Windows
 */
export function findInstalledBrowsers(): BrowserPath[] {
  const browsers: BrowserPath[] = []
  
  // Windows Browser-Pfade
  const windowsPaths = [
    // Chrome
    {
      name: 'Google Chrome',
      path: join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
      type: 'chrome' as const,
    },
    {
      name: 'Google Chrome (x86)',
      path: join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
      type: 'chrome' as const,
    },
    {
      name: 'Google Chrome (Local)',
      path: join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
      type: 'chrome' as const,
    },
    // Edge
    {
      name: 'Microsoft Edge',
      path: join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft\\Edge\\Application\\msedge.exe'),
      type: 'edge' as const,
    },
    {
      name: 'Microsoft Edge (x86)',
      path: join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft\\Edge\\Application\\msedge.exe'),
      type: 'edge' as const,
    },
    // Chromium
    {
      name: 'Chromium',
      path: join(process.env.LOCALAPPDATA || '', 'Chromium\\Application\\chrome.exe'),
      type: 'chromium' as const,
    },
  ]
  
  // Prüfe welche Browser existieren
  for (const browser of windowsPaths) {
    try {
      if (existsSync(browser.path)) {
        browsers.push(browser)
      }
    } catch (error) {
      // Ignoriere Fehler beim Prüfen
    }
  }
  
  return browsers
}

/**
 * Findet den besten verfügbaren Browser
 */
export function findBestBrowser(): BrowserPath | null {
  const browsers = findInstalledBrowsers()
  
  if (browsers.length === 0) {
    return null
  }
  
  // Bevorzuge Chrome > Edge > Chromium
  const chrome = browsers.find(b => b.type === 'chrome')
  if (chrome) return chrome
  
  const edge = browsers.find(b => b.type === 'edge')
  if (edge) return edge
  
  const chromium = browsers.find(b => b.type === 'chromium')
  if (chromium) return chromium
  
  // Fallback: Erster gefundener Browser
  return browsers[0]
}

/**
 * Gibt Browser-Pfad oder null zurück
 */
export function getBrowserExecutablePath(): string | null {
  const browser = findBestBrowser()
  return browser ? browser.path : null
}

/**
 * Prüft ob ein Browser verfügbar ist
 */
export function isBrowserAvailable(): boolean {
  return getBrowserExecutablePath() !== null
}
