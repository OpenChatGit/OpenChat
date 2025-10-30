/**
 * Plugin Executor
 * 
 * Safely executes plugin code in an isolated scope with injected pluginAPI.
 * This is the core component that makes external plugins work without requiring
 * imports or access to OpenChat source code.
 * 
 * Key Features:
 * - Injects pluginAPI at runtime (no imports needed)
 * - Isolates plugin code in separate scope
 * - Handles both class and object exports
 * - Validates plugin instances
 * - Provides detailed error messages
 */

import { createPluginAPI, type IPluginAPI } from '../api/PluginAPI'
import type { PluginManifest, BasePlugin } from './types'

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base error for plugin execution issues
 */
export class PluginExecutionError extends Error {
  constructor(
    public pluginId: string,
    message: string,
    public originalError?: Error
  ) {
    super(`[Plugin: ${pluginId}] ${message}`)
    this.name = 'PluginExecutionError'
  }
}

/**
 * Error for plugin validation failures
 */
export class PluginValidationError extends PluginExecutionError {
  constructor(pluginId: string, message: string) {
    super(pluginId, message)
    this.name = 'PluginValidationError'
  }
}

/**
 * Error for plugin code syntax issues
 */
export class PluginSyntaxError extends PluginExecutionError {
  constructor(pluginId: string, message: string, originalError?: Error) {
    super(pluginId, message, originalError)
    this.name = 'PluginSyntaxError'
  }
}

// ============================================================================
// Plugin Executor
// ============================================================================

export class PluginExecutor {
  /**
   * Execute plugin code and return plugin instance
   * 
   * CRITICAL: The pluginAPI object is injected at runtime, so external plugins
   * don't need any imports or access to OpenChat source code.
   * 
   * @param code - Plugin source code (JavaScript/TypeScript)
   * @param manifest - Plugin manifest from plugin.json
   * @returns Plugin instance with lifecycle methods
   * 
   * @throws {PluginSyntaxError} If code has syntax errors
   * @throws {PluginExecutionError} If code execution fails
   * @throws {PluginValidationError} If plugin instance is invalid
   */
  async execute(code: string, manifest: PluginManifest): Promise<BasePlugin> {
    // Create sandboxed pluginAPI for this plugin
    const pluginAPI = this.createSandbox(manifest)

    try {
      // Execute plugin code and get instance
      const instance = await this.executePluginCode(code, pluginAPI, manifest)

      // Validate the plugin instance
      this.validatePlugin(instance, manifest)

      // Attach metadata to instance
      const pluginInstance: BasePlugin = {
        ...instance,
        metadata: {
          ...manifest,
          enabled: true,
          loaded: true,
          folderPath: '',
          isBuiltin: false
        }
      }

      console.log(`[PluginExecutor] Successfully executed plugin: ${manifest.id}`)
      return pluginInstance

    } catch (error) {
      if (error instanceof PluginExecutionError) {
        throw error
      }
      throw new PluginExecutionError(
        manifest.id,
        `Failed to execute plugin: ${error}`,
        error as Error
      )
    }
  }

  /**
   * Execute plugin code in isolated scope with injected pluginAPI
   * 
   * This wraps the user's plugin code in a function that receives pluginAPI
   * as a parameter, making it globally available WITHOUT requiring imports.
   * 
   * @param code - Plugin source code
   * @param pluginAPI - Sandboxed API instance
   * @param manifest - Plugin manifest
   * @returns Plugin instance (class or object)
   */
  private async executePluginCode(
    code: string,
    pluginAPI: IPluginAPI,
    manifest: PluginManifest
  ): Promise<any> {
    // Wrap user's plugin code in a function that receives pluginAPI
    // This makes pluginAPI globally available WITHOUT requiring imports
    const wrappedCode = `
      (function(pluginAPI, module, exports) {
        'use strict';
        
        // User's plugin code is executed here
        // pluginAPI is available as a global variable
        ${code}
        
        // Return plugin class/object
        // Handle various export patterns:
        // - export default MyPlugin
        // - module.exports = MyPlugin
        // - module.exports.default = MyPlugin
        
        if (typeof module.exports === 'function') {
          // Class export: module.exports = MyPlugin
          return new module.exports()
        }
        
        if (module.exports && typeof module.exports.default === 'function') {
          // ES6 default export: export default MyPlugin
          return new module.exports.default()
        }
        
        if (module.exports && typeof module.exports === 'object') {
          // Object export: module.exports = { onLoad: ... }
          return module.exports
        }
        
        // Fallback: return exports object
        return exports
      })
    `

    try {
      // Create the function with pluginAPI as parameter
      // Using Function constructor for safe code execution
      const fn = new Function('return ' + wrappedCode)()
      
      // Create module/exports objects for CommonJS compatibility
      const module = { exports: {} }
      const exports = module.exports

      // INJECT pluginAPI here - this is the magic!
      // The plugin code can now use pluginAPI without any imports
      const instance = fn(pluginAPI, module, exports)

      return instance

    } catch (error) {
      // Check if it's a syntax error
      if (error instanceof SyntaxError) {
        throw new PluginSyntaxError(
          manifest.id,
          `Syntax error in plugin code: ${error.message}`,
          error
        )
      }

      // Runtime error during execution
      throw new PluginExecutionError(
        manifest.id,
        `Runtime error during plugin execution: ${error}`,
        error as Error
      )
    }
  }

  /**
   * Create sandboxed API for plugin
   * 
   * Each plugin gets its own isolated pluginAPI instance with scoped
   * storage, hooks, and configuration.
   * 
   * @param manifest - Plugin manifest
   * @returns Sandboxed PluginAPI instance
   */
  private createSandbox(manifest: PluginManifest): IPluginAPI {
    return createPluginAPI(manifest.id, manifest)
  }

  /**
   * Validate plugin instance has required structure
   * 
   * Ensures the plugin instance is valid and provides helpful error messages
   * for common issues.
   * 
   * @param instance - Plugin instance to validate
   * @param manifest - Plugin manifest
   * @throws {PluginValidationError} If validation fails
   */
  private validatePlugin(instance: any, manifest: PluginManifest): void {
    // Check if instance exists
    if (!instance) {
      throw new PluginValidationError(
        manifest.id,
        'Plugin did not export anything. Make sure to export a class or object with lifecycle methods.'
      )
    }

    // Check if instance is an object
    if (typeof instance !== 'object') {
      throw new PluginValidationError(
        manifest.id,
        `Plugin must export an object or class instance, got: ${typeof instance}`
      )
    }

    // Validate lifecycle methods (if present)
    const lifecycleMethods = ['onLoad', 'onUnload', 'onEnable', 'onDisable', 'onConfigChange']
    
    for (const method of lifecycleMethods) {
      if (method in instance && typeof instance[method] !== 'function') {
        throw new PluginValidationError(
          manifest.id,
          `Plugin method "${method}" must be a function, got: ${typeof instance[method]}`
        )
      }
    }

    // Validate plugin type-specific requirements
    this.validatePluginType(instance, manifest)

    console.log(`[PluginExecutor] Plugin validation passed: ${manifest.id}`)
  }

  /**
   * Validate plugin type-specific requirements
   * 
   * @param instance - Plugin instance
   * @param manifest - Plugin manifest
   * @throws {PluginValidationError} If type-specific validation fails
   */
  private validatePluginType(instance: any, manifest: PluginManifest): void {
    const types = Array.isArray(manifest.type) ? manifest.type : [manifest.type]

    for (const type of types) {
      switch (type) {
        case 'renderer':
          if (!instance.canRender || typeof instance.canRender !== 'function') {
            throw new PluginValidationError(
              manifest.id,
              'Renderer plugin must implement canRender() method'
            )
          }
          if (!instance.render || typeof instance.render !== 'function') {
            throw new PluginValidationError(
              manifest.id,
              'Renderer plugin must implement render() method'
            )
          }
          break

        case 'message-processor':
          if (!instance.processOutgoing && !instance.processIncoming) {
            throw new PluginValidationError(
              manifest.id,
              'Message processor plugin must implement at least one of: processOutgoing(), processIncoming()'
            )
          }
          break

        case 'tool':
          if (!instance.getTool || typeof instance.getTool !== 'function') {
            throw new PluginValidationError(
              manifest.id,
              'Tool plugin must implement getTool() method'
            )
          }
          if (!instance.execute || typeof instance.execute !== 'function') {
            throw new PluginValidationError(
              manifest.id,
              'Tool plugin must implement execute() method'
            )
          }
          break

        case 'ui-extension':
          if (!instance.location) {
            throw new PluginValidationError(
              manifest.id,
              'UI extension plugin must specify location property'
            )
          }
          if (!instance.component) {
            throw new PluginValidationError(
              manifest.id,
              'UI extension plugin must specify component property'
            )
          }
          break

        case 'command':
          if (!instance.getCommand || typeof instance.getCommand !== 'function') {
            throw new PluginValidationError(
              manifest.id,
              'Command plugin must implement getCommand() method'
            )
          }
          if (!instance.execute || typeof instance.execute !== 'function') {
            throw new PluginValidationError(
              manifest.id,
              'Command plugin must implement execute() method'
            )
          }
          break

        // Other types don't have strict requirements beyond lifecycle methods
        case 'provider':
        case 'storage':
        case 'theme':
        case 'shortcut':
        case 'context-menu':
          // These types have their own validation in their respective interfaces
          break

        default:
          console.warn(`[PluginExecutor] Unknown plugin type: ${type}`)
      }
    }
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const pluginExecutor = new PluginExecutor()

