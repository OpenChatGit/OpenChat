/**
 * Plugin Manager
 * 
 * Central manager for the plugin system. Handles plugin lifecycle,
 * discovery, loading, hooks, and inter-plugin communication.
 */

import { EventBus } from './EventBus'
import { PluginLoader } from './PluginLoader'
import { PluginSecurity } from './PluginSecurity'
import { pluginHooks } from './PluginHooks'
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
    
    // Load plugin state from localStorage on startup
    this.loadPluginState()
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
   * 
   * This method now uses PluginExecutor for plugin instantiation
   * and integrates with the new PluginLoader system.
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

    // Load saved plugin state (enabled/disabled)
    const savedState = this.getSavedPluginState(id)
    if (savedState !== undefined) {
      plugin.metadata.enabled = savedState
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
    } else {
      // If disabled, ensure all hooks are disabled
      this.disablePluginHooks(id)
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
   * 
   * When a plugin is enabled, all its hooks are also enabled.
   * State is persisted to localStorage.
   */
  async enable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin || plugin.metadata.enabled) return

    try {
      if (plugin.onEnable) {
        await plugin.onEnable()
      }
      plugin.metadata.enabled = true
      
      // Enable all hooks for this plugin
      this.enablePluginHooks(pluginId)
      
      // Save state to localStorage
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
   * 
   * When a plugin is disabled, all its hooks are also disabled.
   * State is persisted to localStorage.
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
      
      // Disable all hooks for this plugin
      this.disablePluginHooks(pluginId)
      
      // Save state to localStorage
      this.savePluginState()
      
      console.log(`✓ Plugin disabled: ${plugin.metadata.name}`)
    } catch (error) {
      console.error(`Plugin ${pluginId} failed to disable:`, error)
      throw error
    }
  }

  /**
   * Reload a plugin (hot reload for external plugins)
   * 
   * Alias for reloadPlugin() for backward compatibility.
   */
  async reload(pluginId: string): Promise<void> {
    return this.reloadPlugin(pluginId)
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
   * Save plugin enabled/disabled state to localStorage
   * 
   * This persists the state across app restarts.
   */
  private savePluginState(): void {
    const state: Record<string, boolean> = {}
    this.plugins.forEach((plugin, id) => {
      state[id] = plugin.metadata.enabled
    })
    localStorage.setItem('oc.plugin.state', JSON.stringify(state))
    console.log('[PluginManager] Plugin state saved to localStorage')
  }

  /**
   * Load plugin enabled/disabled state from localStorage
   * 
   * Called on startup to restore plugin states.
   */
  private loadPluginState(): void {
    const stored = localStorage.getItem('oc.plugin.state')
    if (!stored) return

    try {
      const state = JSON.parse(stored) as Record<string, boolean>
      this.plugins.forEach((plugin, id) => {
        if (id in state) {
          plugin.metadata.enabled = state[id]
          
          // Sync hook state with plugin state
          if (state[id]) {
            this.enablePluginHooks(id)
          } else {
            this.disablePluginHooks(id)
          }
        }
      })
      console.log('[PluginManager] Plugin state loaded from localStorage')
    } catch (error) {
      console.error('Failed to load plugin state:', error)
    }
  }

  /**
   * Get saved plugin state for a specific plugin
   * 
   * Returns undefined if no saved state exists.
   */
  private getSavedPluginState(pluginId: string): boolean | undefined {
    const stored = localStorage.getItem('oc.plugin.state')
    if (!stored) return undefined

    try {
      const state = JSON.parse(stored) as Record<string, boolean>
      return state[pluginId]
    } catch (error) {
      console.error('Failed to get saved plugin state:', error)
      return undefined
    }
  }

  /**
   * Enable all hooks for a plugin
   * 
   * This synchronizes hook state with plugin enabled state.
   */
  private enablePluginHooks(pluginId: string): void {
    const hooks = pluginHooks.getAll()
    for (const [_hookType, registrations] of hooks.entries()) {
      for (const registration of registrations) {
        if (registration.pluginId === pluginId) {
          registration.enabled = true
        }
      }
    }
    console.log(`[PluginManager] Enabled all hooks for plugin: ${pluginId}`)
  }

  /**
   * Disable all hooks for a plugin
   * 
   * This synchronizes hook state with plugin disabled state.
   */
  private disablePluginHooks(pluginId: string): void {
    const hooks = pluginHooks.getAll()
    for (const [_hookType, registrations] of hooks.entries()) {
      for (const registration of registrations) {
        if (registration.pluginId === pluginId) {
          registration.enabled = false
        }
      }
    }
    console.log(`[PluginManager] Disabled all hooks for plugin: ${pluginId}`)
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

  /**
   * Create a template plugin in the plugins directory
   * 
   * Generates a basic plugin structure with plugin.json and index.ts
   * to help users get started quickly.
   */
  async createTemplatePlugin(pluginName: string): Promise<void> {
    try {
      // Validate plugin name
      if (!pluginName || pluginName.trim() === '') {
        throw new Error('Plugin name cannot be empty')
      }

      // Convert to kebab-case for ID
      const pluginId = pluginName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

      if (!pluginId) {
        throw new Error('Invalid plugin name')
      }

      // Check if we're in Tauri
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        const { writeTextFile, mkdir, exists } = await import('@tauri-apps/plugin-fs')
        const { join } = await import('@tauri-apps/api/path')
        
        // Get plugins directory
        const { getPluginsDirectory } = await import('../../services/externalPluginLoader')
        const pluginsDir = await getPluginsDirectory()
        
        // Create plugin directory
        const pluginDir = await join(pluginsDir, pluginId)
        const dirExists = await exists(pluginDir)
        
        if (dirExists) {
          throw new Error(`Plugin "${pluginId}" already exists`)
        }
        
        await mkdir(pluginDir, { recursive: true })
        
        // Create plugin.json
        const manifest = {
          id: pluginId,
          name: pluginName,
          version: '1.0.0',
          description: `${pluginName} plugin for OpenChat`,
          author: 'Your Name',
          type: 'message-processor',
          appVersion: '>=0.5.0'
        }
        
        const manifestPath = await join(pluginDir, 'plugin.json')
        await writeTextFile(manifestPath, JSON.stringify(manifest, null, 2))
        
        // Create index.ts with template code
        const templateCode = `/**
 * ${pluginName} Plugin
 * 
 * ${manifest.description}
 */

// The pluginAPI object is globally available - no imports needed!
declare const pluginAPI: any

class ${pluginName.replace(/[^a-zA-Z0-9]/g, '')}Plugin {
  /**
   * Called when the plugin is loaded
   */
  onLoad(): void {
    console.log('${pluginName} loaded!')
    
    // Show a notification
    pluginAPI.ui.showNotification('${pluginName} is active!', 'success')
    
    // Register a hook to modify user messages
    pluginAPI.hooks.register('message.render.user', (context: any) => {
      // Example: Add a prefix to user messages
      // context.content = '👤 ' + context.content
      
      // Always return the context
      return context
    })
    
    // Register a hook to modify assistant messages
    pluginAPI.hooks.register('message.render.assistant', (context: any) => {
      // Example: Add a prefix to assistant messages
      // context.content = '🤖 ' + context.content
      
      // Always return the context
      return context
    })
  }
  
  /**
   * Called when the plugin is unloaded
   */
  onUnload(): void {
    console.log('${pluginName} unloaded!')
    
    // Clean up: unregister hooks
    pluginAPI.hooks.unregister('message.render.user')
    pluginAPI.hooks.unregister('message.render.assistant')
  }
  
  /**
   * Called when the plugin is enabled
   */
  onEnable(): void {
    console.log('${pluginName} enabled!')
  }
  
  /**
   * Called when the plugin is disabled
   */
  onDisable(): void {
    console.log('${pluginName} disabled!')
  }
  
  /**
   * Called when plugin configuration changes
   */
  onConfigChange(config: any): void {
    console.log('${pluginName} config changed:', config)
  }
}

// Export the plugin class
export default ${pluginName.replace(/[^a-zA-Z0-9]/g, '')}Plugin
`
        
        const codePath = await join(pluginDir, 'index.ts')
        await writeTextFile(codePath, templateCode)
        
        // Create README.md
        const readme = `# ${pluginName}

${manifest.description}

## Features

- Modifies user messages
- Modifies assistant messages
- Shows notifications

## Configuration

No configuration required.

## Development

1. Edit \`index.ts\` to customize the plugin behavior
2. Reload the plugin from Settings → Plugins
3. Test your changes

## API Reference

See the Plugin Documentation in Settings → Plugins → Documentation for complete API reference.

## License

MIT
`
        
        const readmePath = await join(pluginDir, 'README.md')
        await writeTextFile(readmePath, readme)
        
        console.log(`[PluginManager] Created template plugin: ${pluginId}`)
        
        // Show success notification
        this.context.ui.notify(
          `Template plugin "${pluginName}" created successfully! Reload plugins to see it.`,
          'success'
        )
      } else {
        throw new Error('Template creation is only available in Tauri environment')
      }
    } catch (error) {
      console.error('[PluginManager] Failed to create template plugin:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.context.ui.notify(`Failed to create template plugin: ${errorMessage}`, 'error')
      throw error
    }
  }

  /**
   * Load all plugins using the new PluginLoader
   * 
   * This method loads both built-in and external plugins using
   * the PluginLoader and PluginExecutor.
   */
  async loadAllPlugins(): Promise<void> {
    console.log('[PluginManager] Loading all plugins...')
    
    try {
      // Load built-in plugins (already instantiated by PluginLoader)
      const builtinPlugins = await this.loader.loadBuiltinPlugins()
      console.log(`[PluginManager] Loaded ${builtinPlugins.length} built-in plugins`)
      
      // Load external plugins (already instantiated by PluginLoader)
      const externalPlugins = await this.loader.loadExternalPlugins()
      console.log(`[PluginManager] Loaded ${externalPlugins.length} external plugins`)
      
      // Register all loaded plugins
      const allPlugins = [...builtinPlugins, ...externalPlugins]
      
      for (const pluginInstance of allPlugins) {
        try {
          // Register the plugin (already instantiated by PluginLoader)
          await this.register(pluginInstance)
          
        } catch (error) {
          console.error(`[PluginManager] Failed to register plugin ${pluginInstance.metadata.id}:`, error)
          // Continue loading other plugins
        }
      }
      
      console.log(`[PluginManager] Successfully loaded ${this.plugins.size} plugins`)
      
    } catch (error) {
      console.error('[PluginManager] Failed to load plugins:', error)
      throw error
    }
  }

  /**
   * Reload a specific plugin using PluginLoader
   * 
   * This is useful for hot-reloading external plugins during development.
   */
  async reloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`)
    }

    // Only external plugins can be reloaded
    if (plugin.metadata.isBuiltin) {
      throw new Error(`Cannot reload built-in plugin: ${pluginId}`)
    }

    console.log(`[PluginManager] Reloading plugin: ${pluginId}`)

    // Preserve state
    const wasEnabled = plugin.metadata.enabled
    const config = this.getPluginConfig(pluginId)
    const folderPath = plugin.metadata.folderPath

    // Unregister old instance
    await this.unregister(pluginId)

    // Clear loader cache for this plugin
    this.loader.clearCache(folderPath)

    try {
      // Reload plugin from disk using the private loadPlugin method
      // Since we can't access it directly, we'll reload all external plugins
      // and find the one we need
      const externalPlugins = await this.loader.loadExternalPlugins()
      const reloadedPlugin = externalPlugins.find(p => p.metadata.id === pluginId)
      
      if (!reloadedPlugin) {
        throw new Error(`Plugin ${pluginId} not found after reload`)
      }
      
      // Update metadata with preserved state
      reloadedPlugin.metadata.enabled = wasEnabled
      
      // Register the plugin
      await this.register(reloadedPlugin)
      
      // Restore config
      if (Object.keys(config).length > 0) {
        await this.setPluginConfig(pluginId, config)
      }
      
      console.log(`[PluginManager] Successfully reloaded plugin: ${pluginId}`)
      
    } catch (error) {
      console.error(`[PluginManager] Failed to reload plugin ${pluginId}:`, error)
      throw error
    }
  }
}
