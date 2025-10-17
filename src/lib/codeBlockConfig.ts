/**
 * Configuration interface for code block rendering
 */
export interface CodeBlockConfig {
  /** Shiki theme to use for syntax highlighting */
  theme: string
  /** Whether to show line numbers in code blocks */
  showLineNumbers: boolean
  /** Array of line numbers to highlight */
  highlightLines: number[]
  /** Maximum height for code blocks (CSS value) */
  maxHeight?: string
  /** Whether to wrap long lines */
  wrapLines: boolean
}

/**
 * Supported programming languages for syntax highlighting
 * Includes 25+ common languages as per requirements
 */
export const supportedLanguages = [
  // Web technologies
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'html',
  'css',
  'scss',
  'json',
  'yaml',
  'xml',
  
  // Backend languages
  'python',
  'java',
  'c',
  'cpp',
  'csharp',
  'go',
  'rust',
  'ruby',
  'php',
  'kotlin',
  'swift',
  
  // Shell and config
  'bash',
  'shell',
  'powershell',
  'dockerfile',
  
  // Data and query
  'sql',
  'graphql',
  
  // Documentation
  'markdown',
  'latex',
  
  // Other
  'r',
  'lua',
  'perl',
  'elixir',
  'haskell',
] as const

/**
 * Type representing a supported language
 */
export type SupportedLanguage = typeof supportedLanguages[number]

/**
 * Default configuration for code blocks
 * Provides sensible defaults for most use cases
 */
export const defaultCodeBlockConfig: CodeBlockConfig = {
  theme: 'github-dark',
  showLineNumbers: false,
  highlightLines: [],
  wrapLines: false,
}

/**
 * Checks if a language is supported
 * 
 * @param language - The language identifier to check
 * @returns True if the language is in the supported list
 */
export function isSupportedLanguage(language: string): language is SupportedLanguage {
  return supportedLanguages.includes(language as SupportedLanguage)
}

/**
 * Gets a normalized language identifier
 * Maps common aliases to standard language names
 * 
 * @param language - The language identifier (may be an alias)
 * @returns Normalized language identifier
 */
export function normalizeLanguage(language: string): string {
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'ts': 'typescript',
    'py': 'python',
    'rb': 'ruby',
    'sh': 'bash',
    'yml': 'yaml',
    'cs': 'csharp',
    'c++': 'cpp',
    'c#': 'csharp',
    'rs': 'rust',
    'md': 'markdown',
    'dockerfile': 'dockerfile',
    'docker': 'dockerfile',
  }

  const normalized = language.toLowerCase().trim()
  return languageMap[normalized] || normalized
}

/**
 * Gets the display name for a language
 * Provides human-readable names for language identifiers
 * 
 * @param language - The language identifier
 * @returns Human-readable display name
 */
export function getLanguageDisplayName(language: string): string {
  const displayNames: Record<string, string> = {
    'javascript': 'JavaScript',
    'typescript': 'TypeScript',
    'jsx': 'JSX',
    'tsx': 'TSX',
    'python': 'Python',
    'java': 'Java',
    'c': 'C',
    'cpp': 'C++',
    'csharp': 'C#',
    'go': 'Go',
    'rust': 'Rust',
    'ruby': 'Ruby',
    'php': 'PHP',
    'html': 'HTML',
    'css': 'CSS',
    'scss': 'SCSS',
    'json': 'JSON',
    'yaml': 'YAML',
    'xml': 'XML',
    'markdown': 'Markdown',
    'sql': 'SQL',
    'bash': 'Bash',
    'shell': 'Shell',
    'powershell': 'PowerShell',
    'dockerfile': 'Dockerfile',
    'graphql': 'GraphQL',
    'kotlin': 'Kotlin',
    'swift': 'Swift',
    'latex': 'LaTeX',
    'r': 'R',
    'lua': 'Lua',
    'perl': 'Perl',
    'elixir': 'Elixir',
    'haskell': 'Haskell',
  }

  const normalized = normalizeLanguage(language)
  return displayNames[normalized] || normalized.toUpperCase()
}
