/**
 * Global Plugin API Type Definitions
 * 
 * This file provides TypeScript definitions for the global `pluginAPI` object
 * that is injected into plugin code at runtime.
 * 
 * External plugin developers can reference this file for type checking.
 */

import type { IPluginAPI } from './PluginAPI'

declare global {
  /**
   * Global pluginAPI object available to all plugins
   * 
   * This object is injected at runtime and provides access to:
   * - hooks: Register hooks to extend functionality
   * - storage: Persistent storage for plugin data
   * - ui: UI interaction methods (notifications, modals, etc.)
   * - config: Plugin configuration management
   * - session: Session management
   * - message: Message handling
   * - plugin: Plugin information
   * 
   * @example
   * ```typescript
   * class MyPlugin {
   *   onLoad() {
   *     // Register a hook
   *     pluginAPI.hooks.register('message.render.user', (context) => {
   *       return <div>Custom UI</div>
   *     })
   *     
   *     // Show notification
   *     pluginAPI.ui.showNotification('Plugin loaded!', 'success')
   *     
   *     // Store data
   *     pluginAPI.storage.set('lastLoaded', Date.now())
   *   }
   * }
   * ```
   */
  const pluginAPI: IPluginAPI

  /**
   * Module exports for plugin code
   * Plugins should export their class or object using module.exports
   * 
   * @example
   * ```typescript
   * class MyPlugin {
   *   onLoad() { }
   *   onUnload() { }
   * }
   * 
   * module.exports = MyPlugin
   * // or: export default MyPlugin
   * ```
   */
  const module: {
    exports: any
  }

  /**
   * Exports object (alias for module.exports)
   */
  const exports: any
}

export {}
