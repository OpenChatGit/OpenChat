/**
 * Secure Storage for sensitive data like API keys
 * 
 * Uses a simple XOR encryption with a device-specific key.
 * This is NOT military-grade encryption, but prevents casual inspection
 * of localStorage and makes it harder to extract keys from disk.
 * 
 * For production use, consider using Tauri's secure storage plugin.
 */

// Generate a device-specific key based on browser fingerprint
function getDeviceKey(): string {
  const nav = navigator as any
  const fingerprint = [
    nav.userAgent,
    nav.language,
    nav.hardwareConcurrency || 0,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
  ].join('|')
  
  // Simple hash function
  let hash = 0
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString(36)
}

// XOR encryption/decryption
function xorCipher(text: string, key: string): string {
  let result = ''
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(
      text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    )
  }
  return result
}

// Base64 encode/decode for safe storage
function toBase64(str: string): string {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
    return String.fromCharCode(parseInt(p1, 16))
  }))
}

function fromBase64(str: string): string {
  return decodeURIComponent(Array.prototype.map.call(atob(str), (c: string) => {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
  }).join(''))
}

/**
 * Securely store a value
 */
export function secureSet(key: string, value: string): void {
  try {
    const deviceKey = getDeviceKey()
    const encrypted = xorCipher(value, deviceKey)
    const encoded = toBase64(encrypted)
    localStorage.setItem(`secure_${key}`, encoded)
  } catch (error) {
    console.error('Failed to securely store value:', error)
  }
}

/**
 * Securely retrieve a value
 */
export function secureGet(key: string): string | null {
  try {
    const encoded = localStorage.getItem(`secure_${key}`)
    if (!encoded) return null
    
    const encrypted = fromBase64(encoded)
    const deviceKey = getDeviceKey()
    const decrypted = xorCipher(encrypted, deviceKey)
    
    return decrypted
  } catch (error) {
    console.error('Failed to securely retrieve value:', error)
    return null
  }
}

/**
 * Securely remove a value
 */
export function secureRemove(key: string): void {
  try {
    localStorage.removeItem(`secure_${key}`)
  } catch (error) {
    console.error('Failed to securely remove value:', error)
  }
}

/**
 * Store API key for a provider
 */
export function setApiKey(providerType: string, apiKey: string): void {
  secureSet(`apikey_${providerType}`, apiKey)
}

/**
 * Get API key for a provider
 */
export function getApiKey(providerType: string): string | null {
  return secureGet(`apikey_${providerType}`)
}

/**
 * Remove API key for a provider
 */
export function removeApiKey(providerType: string): void {
  secureRemove(`apikey_${providerType}`)
}

/**
 * Check if API key exists for a provider
 */
export function hasApiKey(providerType: string): boolean {
  return getApiKey(providerType) !== null
}
