/**
 * Config API
 * 
 * Provides configuration management for plugins.
 * Handles loading defaults from plugin.json and user overrides.
 */

import type { PluginManifest } from '../core/types'

/**
 * Config field definition from plugin.json
 */
export interface ConfigField {
  type: 'string' | 'number' | 'boolean' | 'select'
  label: string
  description?: string
  default?: any
  options?: string[]
  min?: number
  max?: number
  step?: number
}

/**
 * Config schema from plugin.json
 */
export type ConfigSchema = Record<string, ConfigField>

/**
 * Config API for plugins
 */
export class ConfigAPI {
  private pluginId: string
  private schema: ConfigSchema
  private config: Record<string, any>
  private storageKey: string

  constructor(pluginId: string, manifest?: PluginManifest) {
    this.pluginId = pluginId
    this.schema = manifest?.config || {}
    this.storageKey = `oc.plugin.config.${pluginId}`
    
    // Load config from storage or use defaults
    this.config = this.loadConfig()
  }

  /**
   * Get a configuration value
   * 
   * @param key - Config key
   * @param defaultValue - Default value if key doesn't exist
   * @returns The config value
   * 
   * @example
   * ```typescript
   * const apiKey = pluginAPI.config.get('apiKey', '')
   * const maxResults = pluginAPI.config.get('maxResults', 10)
   * ```
   */
  get<T>(key: string, defaultValue?: T): T {
    if (!key || typeof key !== 'string') {
      throw new Error(`[${this.pluginId}] Config key must be a non-empty string`)
    }

    // Check if key exists in config
    if (key in this.config) {
      return this.config[key] as T
    }

    // Check if key exists in schema with default
    if (key in this.schema && this.schema[key].default !== undefined) {
      return this.schema[key].default as T
    }

    // Return provided default value
    if (defaultValue !== undefined) {
      return defaultValue
    }

    // Return undefined if no default found
    return undefined as T
  }

  /**
   * Set a configuration value
   * 
   * @param key - Config key
   * @param value - Config value
   * 
   * @example
   * ```typescript
   * pluginAPI.config.set('apiKey', 'my-secret-key')
   * pluginAPI.config.set('enabled', true)
   * ```
   */
  set<T>(key: string, value: T): void {
    if (!key || typeof key !== 'string') {
      throw new Error(`[${this.pluginId}] Config key must be a non-empty string`)
    }

    // Validate value against schema if defined
    if (key in this.schema) {
      this.validateValue(key, value)
    }

    // Update config
    this.config[key] = value

    // Save to storage
    this.saveConfig()

    console.log(`[ConfigAPI] Plugin "${this.pluginId}" set config: ${key}`)
  }

  /**
   * Get all configuration values
   * 
   * @returns All config values including defaults
   * 
   * @example
   * ```typescript
   * const allConfig = pluginAPI.config.getAll()
   * console.log('Current config:', allConfig)
   * ```
   */
  getAll(): Record<string, any> {
    // Merge defaults from schema with user config
    const defaults = this.getDefaults()
    return { ...defaults, ...this.config }
  }

  /**
   * Reset a config value to its default
   * 
   * @param key - Config key to reset
   * 
   * @example
   * ```typescript
   * pluginAPI.config.reset('apiKey')
   * ```
   */
  reset(key: string): void {
    if (!key || typeof key !== 'string') {
      throw new Error(`[${this.pluginId}] Config key must be a non-empty string`)
    }

    // Remove from user config
    delete this.config[key]

    // Save to storage
    this.saveConfig()

    console.log(`[ConfigAPI] Plugin "${this.pluginId}" reset config: ${key}`)
  }

  /**
   * Reset all config values to defaults
   * 
   * @example
   * ```typescript
   * pluginAPI.config.resetAll()
   * ```
   */
  resetAll(): void {
    this.config = {}
    this.saveConfig()
    console.log(`[ConfigAPI] Plugin "${this.pluginId}" reset all config`)
  }

  /**
   * Check if a config key exists
   * 
   * @param key - Config key to check
   * @returns True if the key exists in config or schema
   */
  has(key: string): boolean {
    return key in this.config || key in this.schema
  }

  /**
   * Get the config schema
   * 
   * @returns The config schema from plugin.json
   */
  getSchema(): ConfigSchema {
    return { ...this.schema }
  }

  /**
   * Update the config schema
   * Used internally when plugin manifest is loaded
   * 
   * @internal
   */
  updateSchema(schema: ConfigSchema): void {
    this.schema = schema
    // Reload config to apply new defaults
    this.config = this.loadConfig()
  }

  /**
   * Load config from localStorage
   */
  private loadConfig(): Record<string, any> {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (error) {
      console.error(`[ConfigAPI] Failed to load config for plugin ${this.pluginId}:`, error)
    }
    return {}
  }

  /**
   * Save config to localStorage
   */
  private saveConfig(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.config))
    } catch (error) {
      console.error(`[ConfigAPI] Failed to save config for plugin ${this.pluginId}:`, error)
      throw new Error(`Failed to save configuration: ${error}`)
    }
  }

  /**
   * Get default values from schema
   */
  private getDefaults(): Record<string, any> {
    const defaults: Record<string, any> = {}
    
    for (const [key, field] of Object.entries(this.schema)) {
      if (field.default !== undefined) {
        defaults[key] = field.default
      }
    }
    
    return defaults
  }

  /**
   * Validate a value against schema
   */
  private validateValue(key: string, value: any): void {
    const field = this.schema[key]
    if (!field) return

    // Type validation
    switch (field.type) {
      case 'string':
        if (typeof value !== 'string') {
          throw new Error(`[${this.pluginId}] Config "${key}" must be a string`)
        }
        break

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          throw new Error(`[${this.pluginId}] Config "${key}" must be a number`)
        }
        // Min/max validation
        if (field.min !== undefined && value < field.min) {
          throw new Error(`[${this.pluginId}] Config "${key}" must be at least ${field.min}`)
        }
        if (field.max !== undefined && value > field.max) {
          throw new Error(`[${this.pluginId}] Config "${key}" must be at most ${field.max}`)
        }
        break

      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new Error(`[${this.pluginId}] Config "${key}" must be a boolean`)
        }
        break

      case 'select':
        if (!field.options || !field.options.includes(value)) {
          throw new Error(
            `[${this.pluginId}] Config "${key}" must be one of: ${field.options?.join(', ')}`
          )
        }
        break

      default:
        console.warn(`[ConfigAPI] Unknown config type for "${key}": ${field.type}`)
    }
  }
}
