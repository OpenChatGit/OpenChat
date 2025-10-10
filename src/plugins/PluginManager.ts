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

  // Get UI extensions by location
  getUIExtensionsByLocation(location: string): any[] {
    const uiPlugins = this.getByType('ui-extension')
    return uiPlugins.filter((plugin: any) => plugin.location === location)
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

  // Get all available tools from tool plugins
  getAllTools() {
    const toolPlugins = this.getByType('tool')
    const tools: any[] = []
    
    for (const plugin of toolPlugins) {
      if ('tools' in plugin && Array.isArray(plugin.tools)) {
        tools.push(...plugin.tools)
      }
    }
    
    return tools
  }

  // Execute a tool by name
  async executeTool(toolName: string, args: Record<string, any>): Promise<string> {
    const toolPlugins = this.getByType('tool')
    
    for (const plugin of toolPlugins) {
      if ('tools' in plugin && 'executeTool' in plugin) {
        const hasThisTool = plugin.tools.some((t: any) => t.function.name === toolName)
        if (hasThisTool) {
          return await plugin.executeTool(toolName, args)
        }
      }
    }
    
    throw new Error(`Tool not found: ${toolName}`)
  }

  // Process outgoing message through all message processor plugins
  async processOutgoing(content: string): Promise<string> {
    const processors = this.getByType('message-processor')
    let processed = content
    
    for (const plugin of processors) {
      if ('processOutgoing' in plugin && plugin.processOutgoing) {
        processed = await plugin.processOutgoing(processed)
      }
    }
    
    return processed
  }

  // Process incoming message through all message processor plugins
  async processIncoming(content: string): Promise<string> {
    const processors = this.getByType('message-processor')
    let processed = content
    
    for (const plugin of processors) {
      if ('processIncoming' in plugin && plugin.processIncoming) {
        processed = await plugin.processIncoming(processed)
      }
    }
    
    return processed
  }
}
