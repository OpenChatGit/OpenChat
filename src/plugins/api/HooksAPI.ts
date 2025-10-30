/**
 * Hooks API
 * 
 * Provides hook registration and management for plugins.
 * Each plugin gets its own scoped HooksAPI instance.
 */

import { pluginHooks } from '../core/PluginHooks'
import type { HookType, HookHandler } from '../core/PluginHooks'

export class HooksAPI {
  private pluginId: string
  private registeredHooks: Set<HookType> = new Set()

  constructor(pluginId: string) {
    this.pluginId = pluginId
  }

  /**
   * Register a hook handler
   * 
   * @param hookType - The type of hook to register
   * @param handler - The handler function to execute
   * @param priority - Execution priority (lower = earlier, default: 100)
   * 
   * @example
   * ```typescript
   * pluginAPI.hooks.register('message.render.user', (context) => {
   *   return <div>Custom UI</div>
   * })
   * ```
   */
  register<T = any>(
    hookType: HookType,
    handler: HookHandler<T>,
    priority: number = 100
  ): void {
    // Validate hook type
    if (!hookType || typeof hookType !== 'string') {
      throw new Error(`[${this.pluginId}] Invalid hook type: ${hookType}`)
    }

    // Validate handler
    if (typeof handler !== 'function') {
      throw new Error(`[${this.pluginId}] Hook handler must be a function`)
    }

    // Validate priority
    if (typeof priority !== 'number' || priority < 0) {
      throw new Error(`[${this.pluginId}] Priority must be a positive number`)
    }

    try {
      // Register with the global hooks manager
      pluginHooks.register(this.pluginId, hookType, handler, priority)
      
      // Track registered hooks for cleanup
      this.registeredHooks.add(hookType)
      
      console.log(`[HooksAPI] Plugin "${this.pluginId}" registered hook: ${hookType}`)
    } catch (error) {
      console.error(`[HooksAPI] Failed to register hook ${hookType} for plugin ${this.pluginId}:`, error)
      throw new Error(`Failed to register hook: ${error}`)
    }
  }

  /**
   * Unregister a specific hook type
   * 
   * @param hookType - The type of hook to unregister
   * 
   * @example
   * ```typescript
   * pluginAPI.hooks.unregister('message.render.user')
   * ```
   */
  unregister(hookType: HookType): void {
    if (!hookType) {
      throw new Error(`[${this.pluginId}] Hook type is required`)
    }

    try {
      // Get all hooks of this type
      const hooks = pluginHooks.getByType(hookType)
      
      // Filter out hooks from this plugin
      const filtered = hooks.filter(h => h.pluginId !== this.pluginId)
      
      // If we removed any hooks, update the tracking
      if (hooks.length !== filtered.length) {
        this.registeredHooks.delete(hookType)
        console.log(`[HooksAPI] Plugin "${this.pluginId}" unregistered hook: ${hookType}`)
      }
    } catch (error) {
      console.error(`[HooksAPI] Failed to unregister hook ${hookType} for plugin ${this.pluginId}:`, error)
      throw new Error(`Failed to unregister hook: ${error}`)
    }
  }

  /**
   * Unregister all hooks for this plugin
   * Called automatically when plugin is unloaded
   * 
   * @internal
   */
  unregisterAll(): void {
    try {
      pluginHooks.unregister(this.pluginId)
      this.registeredHooks.clear()
      console.log(`[HooksAPI] Plugin "${this.pluginId}" unregistered all hooks`)
    } catch (error) {
      console.error(`[HooksAPI] Failed to unregister all hooks for plugin ${this.pluginId}:`, error)
    }
  }

  /**
   * Get all registered hook types for this plugin
   * 
   * @returns Array of hook types registered by this plugin
   */
  getRegisteredHooks(): HookType[] {
    return Array.from(this.registeredHooks)
  }

  /**
   * Check if a specific hook type is registered
   * 
   * @param hookType - The hook type to check
   * @returns True if the hook is registered
   */
  isRegistered(hookType: HookType): boolean {
    return this.registeredHooks.has(hookType)
  }
}
