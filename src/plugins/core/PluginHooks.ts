/**
 * Plugin Hooks System
 * 
 * This system allows plugins to hook into any part of the application
 * without requiring manual integration in each component.
 * 
 * Example:
 * ```typescript
 * // In your plugin:
 * registerHook('message.render.user', (message) => {
 *   return <div>Custom UI under message</div>
 * })
 * ```
 */

import type { Message } from '../../types'

// ============================================================================
// Hook Types
// ============================================================================

/**
 * All available hook points in the application
 */
export type HookType =
  // Message hooks
  | 'message.render.user'           // Render UI under user messages
  | 'message.render.assistant'      // Render UI under AI messages
  | 'message.process.outgoing'      // Process outgoing messages
  | 'message.process.incoming'      // Process incoming messages
  | 'message.actions'               // Add action buttons to messages
  
  // UI hooks
  | 'ui.toolbar'                    // Add toolbar buttons
  | 'ui.sidebar'                    // Add sidebar items
  | 'ui.chat-input'                 // Add chat input buttons
  | 'ui.settings'                   // Add settings panels
  
  // Session hooks
  | 'session.created'               // When a new session is created
  | 'session.deleted'               // When a session is deleted
  | 'session.switched'              // When switching sessions
  
  // Provider hooks
  | 'provider.before-send'          // Before sending to AI
  | 'provider.after-receive'        // After receiving from AI

/**
 * Hook context - data passed to hook handlers
 */
export interface HookContext {
  message?: Message
  session?: any
  [key: string]: any
}

/**
 * Hook handler function
 */
export type HookHandler<T = any> = (context: HookContext) => T | Promise<T>

/**
 * Hook registration
 */
export interface HookRegistration {
  pluginId: string
  hookType: HookType
  handler: HookHandler
  priority: number
  enabled: boolean
}

// ============================================================================
// Plugin Hooks Manager
// ============================================================================

class PluginHooksManager {
  private hooks: Map<HookType, HookRegistration[]> = new Map()

  /**
   * Register a hook handler
   */
  register(
    pluginId: string,
    hookType: HookType,
    handler: HookHandler,
    priority: number = 100
  ): void {
    const registration: HookRegistration = {
      pluginId,
      hookType,
      handler,
      priority,
      enabled: true
    }

    const existing = this.hooks.get(hookType) || []
    existing.push(registration)
    
    // Sort by priority (lower number = higher priority)
    existing.sort((a, b) => a.priority - b.priority)
    
    this.hooks.set(hookType, existing)
    
    console.log(`[PluginHooks] Registered hook: ${hookType} for plugin: ${pluginId}`)
  }

  /**
   * Unregister all hooks for a plugin
   */
  unregister(pluginId: string): void {
    for (const [hookType, registrations] of this.hooks.entries()) {
      const filtered = registrations.filter(r => r.pluginId !== pluginId)
      this.hooks.set(hookType, filtered)
    }
    
    console.log(`[PluginHooks] Unregistered all hooks for plugin: ${pluginId}`)
  }

  /**
   * Execute all handlers for a hook type
   */
  async execute<T = any>(hookType: HookType, context: HookContext): Promise<T[]> {
    const registrations = this.hooks.get(hookType) || []
    const results: T[] = []

    for (const registration of registrations) {
      if (!registration.enabled) continue

      try {
        const result = await registration.handler(context)
        if (result !== undefined) {
          results.push(result)
        }
      } catch (error) {
        console.error(`[PluginHooks] Error executing hook ${hookType} for plugin ${registration.pluginId}:`, error)
      }
    }

    return results
  }

  /**
   * Execute handlers and return first non-null result
   */
  async executeFirst<T = any>(hookType: HookType, context: HookContext): Promise<T | null> {
    const results = await this.execute<T>(hookType, context)
    return results.length > 0 ? results[0] : null
  }

  /**
   * Execute handlers and merge results (for string processing)
   */
  async executeChain(hookType: HookType, initialValue: string, context: HookContext): Promise<string> {
    const registrations = this.hooks.get(hookType) || []
    let value = initialValue

    for (const registration of registrations) {
      if (!registration.enabled) continue

      try {
        const result = await registration.handler({ ...context, value })
        if (typeof result === 'string') {
          value = result
        }
      } catch (error) {
        console.error(`[PluginHooks] Error executing hook ${hookType} for plugin ${registration.pluginId}:`, error)
      }
    }

    return value
  }

  /**
   * Enable/disable a specific hook
   */
  setEnabled(pluginId: string, hookType: HookType, enabled: boolean): void {
    const registrations = this.hooks.get(hookType) || []
    for (const registration of registrations) {
      if (registration.pluginId === pluginId) {
        registration.enabled = enabled
      }
    }
  }

  /**
   * Get all registered hooks
   */
  getAll(): Map<HookType, HookRegistration[]> {
    return new Map(this.hooks)
  }

  /**
   * Get hooks for a specific type
   */
  getByType(hookType: HookType): HookRegistration[] {
    return this.hooks.get(hookType) || []
  }

  /**
   * Clear all hooks
   */
  clear(): void {
    this.hooks.clear()
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const pluginHooks = new PluginHooksManager()
