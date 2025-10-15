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

// Simple, resilient storage helpers with JSON serialization.
// These default to localStorage for portability; can be swapped for IndexedDB later.
export function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function saveLocal<T>(key: string, value: T): void {
  try {
    if (value === undefined) {
      localStorage.removeItem(key)
      return
    }
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Intentionally ignore quota/serialization errors to avoid crashing the UI
  }
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; initialDelayMs?: number; factor?: number; shouldRetry?: (e: unknown) => boolean } = {}
): Promise<T> {
  const {
    retries = 2,
    initialDelayMs = 300,
    factor = 2,
    shouldRetry = () => true,
  } = options

  let attempt = 0
  let delay = initialDelayMs

  // First attempt
  try {
    return await fn()
  } catch (e) {
    if (!shouldRetry(e) || retries === 0) throw e
  }

  while (attempt < retries) {
    await new Promise(r => setTimeout(r, delay))
    try {
      return await fn()
    } catch (e) {
      if (!shouldRetry(e) || attempt === retries - 1) throw e
      delay *= factor
      attempt++
    }
  }

  // Should be unreachable
  return await fn()
}

// Lightweight runtime validation helpers (type guards)
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isValidMessage(value: unknown): value is {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
} {
  if (!isObject(value)) return false
  return (
    typeof value.id === 'string' &&
    (value.role === 'user' || value.role === 'assistant' || value.role === 'system') &&
    typeof value.content === 'string' &&
    typeof value.timestamp === 'number'
  )
}

export function isValidSession(value: unknown): value is {
  id: string
  title: string
  messages: any[]
  provider: string
  model: string
  createdAt: number
  updatedAt: number
} {
  if (!isObject(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    Array.isArray(value.messages) && value.messages.every(isValidMessage) &&
    typeof value.provider === 'string' &&
    typeof value.model === 'string' &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number'
  )
}

export function validateSessions(value: unknown): any[] {
  if (!Array.isArray(value)) return []
  return value.filter(isValidSession)
}

export function isValidProviderConfig(value: unknown): value is {
  type: string
  name: string
  baseUrl: string
  enabled: boolean
  apiKey?: string
} {
  if (!isObject(value)) return false
  return (
    typeof value.type === 'string' &&
    typeof value.name === 'string' &&
    typeof value.baseUrl === 'string' &&
    typeof value.enabled === 'boolean' &&
    (value.apiKey === undefined || typeof value.apiKey === 'string')
  )
}