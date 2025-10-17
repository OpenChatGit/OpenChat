import { createHighlighter, Highlighter } from 'shiki'

/**
 * Singleton instance of the Shiki highlighter
 * Cached to avoid re-initialization overhead
 */
let highlighterInstance: Highlighter | null = null

/**
 * Promise to track ongoing initialization
 * Prevents multiple simultaneous initialization attempts
 */
let initializationPromise: Promise<Highlighter> | null = null

/**
 * Set of languages that have been loaded
 * Used to track lazy-loaded languages
 */
const loadedLanguages = new Set<string>([
  // Default languages loaded on initialization
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'python',
])

/**
 * Gets or creates the Shiki highlighter instance
 * Uses singleton pattern with async initialization and caching
 * 
 * @returns Promise resolving to the Highlighter instance
 * @throws Error if initialization fails
 */
export async function getOrCreateHighlighter(): Promise<Highlighter> {
  // Return cached instance if available
  if (highlighterInstance) {
    return highlighterInstance
  }

  // Return ongoing initialization if in progress
  if (initializationPromise) {
    return initializationPromise
  }

  // Start new initialization
  initializationPromise = (async () => {
    try {
      const highlighter = await createHighlighter({
        themes: ['github-dark'],
        langs: Array.from(loadedLanguages),
      })

      highlighterInstance = highlighter
      return highlighter
    } catch (error) {
      // Reset promise on failure to allow retry
      initializationPromise = null
      throw new Error(`Failed to initialize Shiki highlighter: ${error}`)
    }
  })()

  return initializationPromise
}

/**
 * Lazy loads a language grammar if not already loaded
 * 
 * @param language - The language identifier to load
 * @returns Promise that resolves when language is loaded
 */
export async function loadLanguage(language: string): Promise<void> {
  // Skip if already loaded
  if (loadedLanguages.has(language)) {
    return
  }

  try {
    const highlighter = await getOrCreateHighlighter()
    
    // Check if language is already loaded in the highlighter
    const loadedLangs = highlighter.getLoadedLanguages()
    if (loadedLangs.includes(language as any)) {
      loadedLanguages.add(language)
      return
    }

    // Load the language
    await highlighter.loadLanguage(language as any)
    loadedLanguages.add(language)
  } catch (error) {
    console.warn(`Failed to load language "${language}":`, error)
    // Don't throw - graceful degradation to plain text
  }
}

/**
 * Checks if a language is currently loaded
 * 
 * @param language - The language identifier to check
 * @returns True if the language is loaded
 */
export function isLanguageLoaded(language: string): boolean {
  return loadedLanguages.has(language)
}

/**
 * Gets the list of currently loaded languages
 * 
 * @returns Array of loaded language identifiers
 */
export function getLoadedLanguages(): string[] {
  return Array.from(loadedLanguages)
}

/**
 * Resets the highlighter instance (useful for testing)
 * WARNING: This will force re-initialization on next use
 */
export function resetHighlighter(): void {
  highlighterInstance = null
  initializationPromise = null
  // Keep loaded languages set intact for tracking
}
