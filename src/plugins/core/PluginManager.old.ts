// Plugin Manager - manages all plugins and their lifecycle

import type { Plugin, PluginContext, PluginType } from './types'

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map()
  private context: PluginContext

  constructor(context: PluginContext) {
    this.context = context
  }

  // Register a plugin
  async register(plugin: Plugin): Promise<void> {
    if (this.plugins.has(plugin.metadata.id)) {
      console.log(`Plugin ${plugin.metadata.id} is already registered, skipping`)
      return
    }

    this.plugins.set(plugin.metadata.id, plugin)
    
    // Call lifecycle hook
    if (plugin.onLoad) {
      await plugin.onLoad(this.context)
    }

    if (plugin.metadata.enabled && plugin.onEnable) {
      await plugin.onEnable()
    }

    console.log(`Plugin registered: ${plugin.metadata.name} v${plugin.metadata.version}`)
  }
  // Unregister a plugin
  async unregister(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return

    if (plugin.metadata.enabled && plugin.onDisable) {
      await plugin.onDisable()
    }

    if (plugin.onUnload) {
      await plugin.onUnload()
    }

    this.plugins.delete(pluginId)
    console.log(`Plugin unregistered: ${plugin.metadata.name}`)
  }

  // Enable a plugin
  async enable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin || plugin.metadata.enabled) return

    plugin.metadata.enabled = true
    if (plugin.onEnable) {
      await plugin.onEnable()
    }

    console.log(`Plugin enabled: ${plugin.metadata.name}`)
  }

  // Disable a plugin
  async disable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin || !plugin.metadata.enabled) return

    plugin.metadata.enabled = false
    if (plugin.onDisable) {
      await plugin.onDisable()
    }

    console.log(`Plugin disabled: ${plugin.metadata.name}`)
  }

  // Get all plugins
  getAll(): Plugin[] {
    return Array.from(this.plugins.values())
  }

  // Get plugins by type
  getByType<T extends Plugin>(type: PluginType): T[] {
    return Array.from(this.plugins.values())
      .filter(p => p.metadata.type === type && p.metadata.enabled) as T[]
  }

  // Get a specific plugin
  get<T extends Plugin>(pluginId: string): T | undefined {
    return this.plugins.get(pluginId) as T | undefined
  }

  // Check if a plugin is registered
  has(pluginId: string): boolean {
    return this.plugins.has(pluginId)
  }

  // Get enabled plugins count
  getEnabledCount(): number {
    return Array.from(this.plugins.values()).filter(p => p.metadata.enabled).length
  }
}
