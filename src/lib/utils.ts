import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return date.toLocaleDateString()
}

/**
 * Truncates a model name to a maximum length
 * @param name - The model name to truncate
 * @param maxLength - Maximum length (default: 30)
 * @returns Truncated name with ellipsis if needed
 */
export function truncateModelName(name: string, maxLength: number = 30): string {
  if (!name) return 'Select Model'
  if (name.length <= maxLength) return name
  
  // Try to truncate at a sensible point (after a colon or slash)
  const separators = [':', '/', '-']
  for (const sep of separators) {
    const parts = name.split(sep)
    if (parts.length > 1) {
      // Keep the last part if it's short enough
      const lastPart = parts[parts.length - 1]
      if (lastPart.length <= maxLength) {
        return `...${sep}${lastPart}`
      }
    }
  }
  
  // Fallback: simple truncation with ellipsis
  return name.substring(0, maxLength - 3) + '...'
}

/**
 * Gets a display name for a model
 * @param name - The model name
 * @param isAvailable - Whether the model is available
 * @returns Display name or placeholder
 */
export function getModelDisplayName(name: string | null | undefined, isAvailable: boolean = true): string {
  if (!name) return 'Select Model'
  if (!isAvailable) return `${truncateModelName(name)} (unavailable)`
  return truncateModelName(name)
}
