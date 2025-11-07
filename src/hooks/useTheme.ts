import { useState, useEffect } from 'react'
import { loadLocal, saveLocal } from '../lib/utils'

export type Theme = 'light' | 'dark' | 'system'

async function getSystemThemeFromTauri(): Promise<'light' | 'dark'> {
  try {
    // Try to get theme from Tauri window
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const currentWindow = getCurrentWindow()
      const windowTheme = await currentWindow.theme()
      
      console.log('[Theme] Tauri window theme:', windowTheme)
      
      if (windowTheme === 'light') {
        return 'light'
      } else if (windowTheme === 'dark') {
        return 'dark'
      }
    }
  } catch (error) {
    console.warn('[Theme] Failed to get Tauri window theme:', error)
  }
  
  // Fallback to CSS media query
  if (typeof window !== 'undefined' && window.matchMedia) {
    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const lightQuery = window.matchMedia('(prefers-color-scheme: light)')
    
    console.log('[Theme] Media query fallback:', {
      darkMatches: darkQuery.matches,
      lightMatches: lightQuery.matches
    })
    
    if (lightQuery.matches) {
      return 'light'
    }
  }
  
  return 'dark'
}

function getSystemTheme(): 'light' | 'dark' {
  // Synchronous fallback - will be updated by async call
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'dark'
}

function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return getSystemTheme()
  }
  return theme
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return loadLocal<Theme>('theme', 'system')
  })
  
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => getSystemTheme())

  // Update system theme from Tauri on mount and listen for changes
  useEffect(() => {
    if (theme === 'system') {
      // Initial detection
      getSystemThemeFromTauri().then(detectedTheme => {
        console.log('[Theme] Detected system theme from Tauri:', detectedTheme)
        setSystemTheme(detectedTheme)
        document.documentElement.setAttribute('data-theme', detectedTheme)
      })
      
      // Listen for theme changes from Tauri
      let unlisten: (() => void) | undefined
      
      const setupListener = async () => {
        try {
          if (typeof window !== 'undefined' && '__TAURI__' in window) {
            const { getCurrentWindow } = await import('@tauri-apps/api/window')
            const currentWindow = getCurrentWindow()
            
            unlisten = await currentWindow.onThemeChanged(({ payload: newTheme }) => {
              console.log('[Theme] Tauri theme changed to:', newTheme)
              const detectedTheme = newTheme === 'light' ? 'light' : 'dark'
              setSystemTheme(detectedTheme)
              document.documentElement.setAttribute('data-theme', detectedTheme)
            })
          }
        } catch (error) {
          console.warn('[Theme] Failed to setup theme listener:', error)
        }
      }
      
      setupListener()
      
      return () => {
        if (unlisten) {
          unlisten()
        }
      }
    }
  }, [theme])

  useEffect(() => {
    const effectiveTheme = theme === 'system' ? systemTheme : theme
    
    console.log('[Theme] Applying theme:', {
      selectedTheme: theme,
      systemTheme,
      effectiveTheme,
      currentAttribute: document.documentElement.getAttribute('data-theme')
    })
    
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', effectiveTheme)
    saveLocal('theme', theme)

    // Listen for system theme changes when in system mode
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      
      const handleChange = (e: MediaQueryListEvent) => {
        const newTheme = e.matches ? 'dark' : 'light'
        document.documentElement.setAttribute('data-theme', newTheme)
      }

      // Modern browsers
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange)
        return () => mediaQuery.removeEventListener('change', handleChange)
      }
      // Legacy browsers
      else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleChange)
        return () => mediaQuery.removeListener(handleChange)
      }
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => {
      if (prev === 'system') return 'light'
      if (prev === 'light') return 'dark'
      return 'system'
    })
  }

  return {
    theme,
    effectiveTheme: theme === 'system' ? systemTheme : theme,
    setTheme,
    toggleTheme,
  }
}
