/**
 * Storage API
 * 
 * Provides isolated storage for plugins using localStorage.
 * Each plugin gets its own namespace to prevent conflicts.
 */

export class StorageAPI {
  private pluginId: string
  private prefix: string

  constructor(pluginId: string) {
    this.pluginId = pluginId
    this.prefix = `oc.plugin.storage.${pluginId}.`
  }

  /**
   * Get a value from storage
   * 
   * @param key - Storage key
   * @param defaultValue - Default value if key doesn't exist
   * @returns The stored value or default value
   * 
   * @example
   * ```typescript
   * const count = await pluginAPI.storage.get('count', 0)
   * ```
   */
  async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    this.validateKey(key)

    try {
      const fullKey = this.prefix + key
      const stored = localStorage.getItem(fullKey)
      
      if (stored === null) {
        return defaultValue
      }

      return JSON.parse(stored) as T
    } catch (error) {
      console.error(`[StorageAPI] Failed to get key "${key}" for plugin ${this.pluginId}:`, error)
      return defaultValue
    }
  }

  /**
   * Set a value in storage
   * 
   * @param key - Storage key
   * @param value - Value to store (must be JSON-serializable)
   * 
   * @example
   * ```typescript
   * await pluginAPI.storage.set('count', 42)
   * await pluginAPI.storage.set('user', { name: 'John', age: 30 })
   * ```
   */
  async set<T>(key: string, value: T): Promise<void> {
    this.validateKey(key)

    try {
      const fullKey = this.prefix + key
      const serialized = JSON.stringify(value)
      localStorage.setItem(fullKey, serialized)
      
      console.log(`[StorageAPI] Plugin "${this.pluginId}" set key: ${key}`)
    } catch (error) {
      console.error(`[StorageAPI] Failed to set key "${key}" for plugin ${this.pluginId}:`, error)
      throw new Error(`Failed to save data: ${error}`)
    }
  }

  /**
   * Delete a value from storage
   * 
   * @param key - Storage key to delete
   * 
   * @example
   * ```typescript
   * await pluginAPI.storage.delete('count')
   * ```
   */
  async delete(key: string): Promise<void> {
    this.validateKey(key)

    try {
      const fullKey = this.prefix + key
      localStorage.removeItem(fullKey)
      
      console.log(`[StorageAPI] Plugin "${this.pluginId}" deleted key: ${key}`)
    } catch (error) {
      console.error(`[StorageAPI] Failed to delete key "${key}" for plugin ${this.pluginId}:`, error)
      throw new Error(`Failed to delete data: ${error}`)
    }
  }

  /**
   * Clear all storage for this plugin
   * 
   * @example
   * ```typescript
   * await pluginAPI.storage.clear()
   * ```
   */
  async clear(): Promise<void> {
    try {
      // Get all keys for this plugin
      const keys = this.getAllKeys()
      
      // Remove each key
      keys.forEach(key => localStorage.removeItem(key))
      
      console.log(`[StorageAPI] Plugin "${this.pluginId}" cleared all storage (${keys.length} keys)`)
    } catch (error) {
      console.error(`[StorageAPI] Failed to clear storage for plugin ${this.pluginId}:`, error)
      throw new Error(`Failed to clear storage: ${error}`)
    }
  }

  /**
   * Get all keys stored by this plugin
   * 
   * @returns Array of storage keys (without prefix)
   * 
   * @example
   * ```typescript
   * const keys = await pluginAPI.storage.keys()
   * console.log('Stored keys:', keys)
   * ```
   */
  async keys(): Promise<string[]> {
    try {
      const allKeys = this.getAllKeys()
      
      // Remove prefix from keys
      return allKeys.map(key => key.substring(this.prefix.length))
    } catch (error) {
      console.error(`[StorageAPI] Failed to get keys for plugin ${this.pluginId}:`, error)
      return []
    }
  }

  /**
   * Check if a key exists in storage
   * 
   * @param key - Storage key to check
   * @returns True if the key exists
   * 
   * @example
   * ```typescript
   * if (await pluginAPI.storage.has('count')) {
   *   console.log('Count exists')
   * }
   * ```
   */
  async has(key: string): Promise<boolean> {
    this.validateKey(key)

    try {
      const fullKey = this.prefix + key
      return localStorage.getItem(fullKey) !== null
    } catch (error) {
      console.error(`[StorageAPI] Failed to check key "${key}" for plugin ${this.pluginId}:`, error)
      return false
    }
  }

  /**
   * Get the size of stored data in bytes (approximate)
   * 
   * @returns Approximate size in bytes
   */
  async size(): Promise<number> {
    try {
      const keys = this.getAllKeys()
      let totalSize = 0

      keys.forEach(key => {
        const value = localStorage.getItem(key)
        if (value) {
          // Approximate size: key length + value length
          totalSize += key.length + value.length
        }
      })

      return totalSize
    } catch (error) {
      console.error(`[StorageAPI] Failed to calculate size for plugin ${this.pluginId}:`, error)
      return 0
    }
  }

  /**
   * Validate storage key
   */
  private validateKey(key: string): void {
    if (!key || typeof key !== 'string') {
      throw new Error(`[${this.pluginId}] Storage key must be a non-empty string`)
    }

    if (key.includes('.')) {
      throw new Error(`[${this.pluginId}] Storage key cannot contain dots`)
    }

    if (key.length > 100) {
      throw new Error(`[${this.pluginId}] Storage key is too long (max 100 characters)`)
    }
  }

  /**
   * Get all localStorage keys for this plugin
   */
  private getAllKeys(): string[] {
    const keys: string[] = []
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(this.prefix)) {
        keys.push(key)
      }
    }
    
    return keys
  }
}
