/**
 * Plugin Manager
 * 
 * Central manager for the plugin system. Handles plugin lifecycle,
 * discovery, loading, hooks, and inter-plugin communication.
 */

import { EventBus } from './EventBus'
import { PluginLoader } from './PluginLoader'
import { PluginSecurity } from './PluginSecurity'
import type {
  BasePlugin,
  PluginContext,
  PluginMetadata,
  PluginType,
  AppContext,
  StorageContext,
  UIContext,
  LoggerContext
} from './types'

interface HookRegistration {
  pluginId: string
  handler: Function
  priority: number
  async: boolean
}

export class PluginManager {
  private plugins: Map<string, BasePlugin> = new Map()
  private hooks: Map<string, HookRegistration[]> = new Map()
  private context: PluginContext
  private eventBus: EventBus
  private loader: PluginLoader
  private security: PluginSecurity
  private appContext: AppContext

  constructor(appContext: AppContext) {
    this.appContext = appContext
    this.eventBus = new EventBus()
    this.loader = new PluginLoader()
    this.security = new PluginSecurity()
    this.context = this.createContext()
  }

  /**
   * Create plugin context
   */
  private createContext(): PluginContext {
    const storageContext: StorageContext = {
      get: <T>(key: string, defaultValue?: T) => {
        try {
          const stored = localStorage.getItem(`oc.plugin.data.${key}`)
          return stored ? JSON.parse(stored) : defaultValue
        } catch {
          return defaultValue
        }
      },
      set: <T>(key: string, value: T) => {
        try {
          localStorage.setItem(`oc.plugin.data.${key}`, JSON.stringify(value))
        } catch (error) {
          console.error('Failed to save plugin data:', error)
        }
      },
      delete: (key: string) => {
        localStorage.removeItem(`oc.plugin.data.${key}`)
      },
      clear: () => {
        // Clear all plugin data keys
        const keys = Object.keys(localStorage).filter(k => k.startsWith('oc.plugin.data.'))
        keys.forEach(k => localStorage.removeItem(k))
      }
    }

    const uiContext: UIContext = {
      notify: (message: string, type = 'info') => {
        console.log(`[${type.toUpperCase()}] ${message}`)
        // TODO: Integrate with actual notification system
      },
      confirm: async (message: string) => {
        return confirm(message)
      },
      prompt: async (message: string, defaultValue?: string) => {
        return prompt(message, defaultValue)
      },
      showModal: (component: React.ComponentType) => {
        // TODO: Integrate with modal system
        console.log('Show modal:', component)
      },
      hideModal: () => {
        // TODO: Integrate with modal system
        console.log('Hide modal')
      }
    }

    const loggerContext: LoggerContext = {
      debug: (message: string, ...args: any[]) => {
        console.debug(`[Plugin]`, message, ...args)
      },
      info: (message: string, ...args: any[]) => {
        console.info(`[Plugin]`, message, ...args)
      },
      warn: (message: string, ...args: any[]) => {
        console.warn(`[Plugin]`, message, ...args)
      },
      error: (message: string, ...args: any[]) => {
        console.error(`[Plugin]`, message, ...args)
      }
    }

    return {
      app: this.appContext,
      storage: storageContext,
      events: this.eventBus,
      ui: uiContext,
      logger: loggerContext,
      getPlugin: <T extends BasePlugin>(pluginId: string) => this.getPlugin<T>(pluginId),
      getPlugins: (type?: PluginType) => this.getPlugins(type),
      getConfig: <T = any>() => ({} as T), // Will be overridden per plugin
      setConfig: <T = any>(_config: Partial<T>) => {} // Will be overridden per plugin
    }
  }

  /**
   * Register a plugin
   */
  async register(plugin: BasePlugin): Promise<void> {
    const { id } = plugin.metadata

    // Check if already registered
    if (this.plugins.has(id)) {
      console.warn(`Plugin ${id} is already registered`)
      return
    }

    // Validate plugin
    if (!this.security.validatePlugin(plugin.metadata)) {
      // Request approval for external plugins
      if (!plugin.metadata.isBuiltin) {
        const approved = await this.security.requestApproval(
          plugin.metadata.name,
          id
        )
        if (!approved) {
          throw new Error(`Plugin ${id} was not approved by user`)
        }
      }
    }

    // Check permissions
    if (plugin.metadata.permissions) {
      for (const permission of plugin.metadata.permissions) {
        const granted = await this.security.requestPermission(
          id,
          plugin.metadata.name,
          permission
        )
        if (!granted) {
          throw new Error(`Plugin ${id} requires permission: ${permission}`)
        }
      }
    }

    // Store plugin
    this.plugins.set(id, plugin)
    plugin.metadata.loaded = true

    // Create plugin-specific context
    const pluginContext: PluginContext = {
      ...this.context,
      getConfig: <T = any>() => this.getPluginConfig<T>(id),
      setConfig: <T = any>(pluginConfig: Partial<T>) => this.setPluginConfig<T>(id, pluginConfig)
    }

    // Call onLoad hook
    try {
      if (plugin.onLoad) {
        await plugin.onLoad(pluginContext)
      }
    } catch (error) {
      plugin.metadata.error = `Failed to load: ${error}`
      plugin.metadata.loaded = false
      console.error(`Plugin ${id} failed to load:`, error)
      throw error
    }

    // Register hooks
    if (plugin.metadata.hooks) {
      for (const [hookName, config] of Object.entries(plugin.metadata.hooks)) {
        const handler = (plugin as any)[hookName]
        if (handler && typeof handler === 'function') {
          this.registerHook(hookName, plugin, handler.bind(plugin), config.priority, config.async)
        }
      }
    }

    // Enable if not disabled
    if (plugin.metadata.enabled) {
      await this.enable(id)
    }

    console.log(`✓ Plugin registered: ${plugin.metadata.name} v${plugin.metadata.version}`)
  }

  /**
   * Unregister a plugin
   */
  async unregister(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return

    // Disable first
    if (plugin.metadata.enabled) {
      await this.disable(pluginId)
    }

    // Call onUnload hook
    try {
      if (plugin.onUnload) {
        await plugin.onUnload()
      }
    } catch (error) {
      console.error(`Plugin ${pluginId} failed to unload:`, error)
    }

    // Unregister hooks
    this.unregisterAllHooks(pluginId)

    // Remove from storage
    this.plugins.delete(pluginId)
    plugin.metadata.loaded = false

    console.log(`✓ Plugin unregistered: ${plugin.metadata.name}`)
  }

  /**
   * Enable a plugin
   */
  async enable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin || plugin.metadata.enabled) return

    try {
      if (plugin.onEnable) {
        await plugin.onEnable()
      }
      plugin.metadata.enabled = true
      this.savePluginState()
      console.log(`✓ Plugin enabled: ${plugin.metadata.name}`)
    } catch (error) {
      plugin.metadata.error = `Failed to enable: ${error}`
      console.error(`Plugin ${pluginId} failed to enable:`, error)
      throw error
    }
  }

  /**
   * Disable a plugin
   */
  async disable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin || !plugin.metadata.enabled) return

    // Core plugins cannot be disabled
    if (plugin.metadata.core) {
      throw new Error(`Cannot disable core plugin: ${pluginId}`)
    }

    try {
      if (plugin.onDisable) {
        await plugin.onDisable()
      }
      plugin.metadata.enabled = false
      this.savePluginState()
      console.log(`✓ Plugin disabled: ${plugin.metadata.name}`)
    } catch (error) {
      console.error(`Plugin ${pluginId} failed to disable:`, error)
      throw error
    }
  }

  /**
   * Reload a plugin (hot reload for external plugins)
   */
  async reload(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`)
    }

    // Only external plugins can be reloaded
    if (plugin.metadata.isBuiltin) {
      throw new Error(`Cannot reload built-in plugin: ${pluginId}`)
    }

    // TODO: Preserve state for reload
    // const wasEnabled = plugin.metadata.enabled
    // const config = this.getPluginConfig(pluginId)

    // Unregister old instance
    await this.unregister(pluginId)

    // Clear loader cache
    this.loader.clearCache(plugin.metadata.folderPath)

    // TODO: Re-import plugin module
    // This would require dynamic import which needs to be implemented
    // based on how external plugins are loaded

    console.log(`✓ Plugin reloaded: ${plugin.metadata.name}`)
  }

  /**
   * Get a specific plugin
   */
  getPlugin<T extends BasePlugin>(pluginId: string): T | undefined {
    return this.plugins.get(pluginId) as T | undefined
  }

  /**
   * Get all plugins (enabled and disabled)
   */
  getAllPlugins(): BasePlugin[] {
    return Array.from(this.plugins.values())
  }

  /**
   * Get all plugins, optionally filtered by type (only enabled)
   */
  getPlugins(type?: PluginType): BasePlugin[] {
    const plugins = Array.from(this.plugins.values())
    
    if (!type) {
      return plugins.filter(p => p.metadata.enabled)
    }

    return plugins.filter(p => {
      if (!p.metadata.enabled) return false
      const types = Array.isArray(p.metadata.type) ? p.metadata.type : [p.metadata.type]
      return types.includes(type)
    })
  }

  /**
   * Get plugins by type (alias for getPlugins with type filter)
   */
  getByType<T extends BasePlugin>(type: PluginType): T[] {
    return this.getPlugins(type) as T[]
  }

  /**
   * Get plugin metadata
   */
  getPluginMetadata(pluginId: string): PluginMetadata | undefined {
    return this.plugins.get(pluginId)?.metadata
  }

  /**
   * Get all plugin metadata
   */
  getAllMetadata(): PluginMetadata[] {
    return Array.from(this.plugins.values()).map(p => p.metadata)
  }

  /**
   * Register a hook
   */
  private registerHook(
    hookName: string,
    plugin: BasePlugin,
    handler: Function,
    priority: number = 10,
    _async: boolean = false
  ): void {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, [])
    }

    const registration: HookRegistration = {
      pluginId: plugin.metadata.id,
      handler,
      priority,
      async: _async
    }

    this.hooks.get(hookName)!.push(registration)

    // Sort by priority (lower = earlier)
    this.hooks.get(hookName)!.sort((a, b) => a.priority - b.priority)
  }

  /**
   * Unregister all hooks for a plugin
   */
  private unregisterAllHooks(pluginId: string): void {
    this.hooks.forEach((registrations, hookName) => {
      this.hooks.set(
        hookName,
        registrations.filter(r => r.pluginId !== pluginId)
      )
    })
  }

  /**
   * Execute a hook
   */
  async executeHook<T>(hookName: string, data: T): Promise<T> {
    const registrations = this.hooks.get(hookName)
    if (!registrations || registrations.length === 0) {
      return data
    }

    let result = data

    for (const registration of registrations) {
      try {
        const returned = await registration.handler(result)
        if (returned !== undefined) {
          result = returned
        }
      } catch (error) {
        console.error(`Error in hook ${hookName} (plugin: ${registration.pluginId}):`, error)
      }
    }

    return result
  }

  /**
   * Get plugin configuration
   */
  getPluginConfig<T = any>(pluginId: string): T {
    const key = `oc.plugin.config.${pluginId}`
    const stored = localStorage.getItem(key)
    
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        return {} as T
      }
    }

    // Return default config from manifest
    const plugin = this.plugins.get(pluginId)
    if (plugin?.metadata.config) {
      const defaults: any = {}
      const schema = plugin.metadata.config
      
      if (schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          const propDef = prop as any
          if (propDef.default !== undefined) {
            defaults[key] = propDef.default
          }
        }
      }
      
      return defaults as T
    }

    return {} as T
  }

  /**
   * Set plugin configuration
   */
  async setPluginConfig<T = any>(pluginId: string, config: Partial<T>): Promise<void> {
    const current = this.getPluginConfig<T>(pluginId)
    const updated = { ...current, ...config }
    
    const key = `oc.plugin.config.${pluginId}`
    localStorage.setItem(key, JSON.stringify(updated))

    // Call onConfigChange hook
    const plugin = this.plugins.get(pluginId)
    if (plugin?.onConfigChange) {
      try {
        await plugin.onConfigChange(updated)
      } catch (error) {
        console.error(`Plugin ${pluginId} failed to handle config change:`, error)
      }
    }
  }

  /**
   * Save plugin enabled/disabled state
   */
  private savePluginState(): void {
    const state: Record<string, boolean> = {}
    this.plugins.forEach((plugin, id) => {
      state[id] = plugin.metadata.enabled
    })
    localStorage.setItem('oc.plugin.state', JSON.stringify(state))
  }

  /**
   * Load plugin enabled/disabled state
   */
  loadPluginState(): void {
    const stored = localStorage.getItem('oc.plugin.state')
    if (!stored) return

    try {
      const state = JSON.parse(stored) as Record<string, boolean>
      this.plugins.forEach((plugin, id) => {
        if (id in state) {
          plugin.metadata.enabled = state[id]
        }
      })
    } catch (error) {
      console.error('Failed to load plugin state:', error)
    }
  }

  /**
   * Get event bus (for external access)
   */
  getEventBus(): EventBus {
    return this.eventBus
  }

  /**
   * Get security manager (for external access)
   */
  getSecurity(): PluginSecurity {
    return this.security
  }

  /**
   * Get loader (for external access)
   */
  getLoader(): PluginLoader {
    return this.loader
  }
}
