import { useState, useEffect, useMemo } from 'react'
import { PluginManager } from '../plugins/core/PluginManager'
import { MarkdownRendererPlugin } from '../plugins/builtin/markdown-renderer'
import { MessageExportPlugin } from '../plugins/builtin/MessageExportPlugin'
import { createTimestampPlugin } from '../plugins/builtin/TimestampPluginWrapper'
import { ensurePluginsDirectory } from '../services/externalPluginLoader'
import type { BasePlugin, AppContext } from '../plugins/core'

export function usePlugins() {
  const [plugins, setPlugins] = useState<BasePlugin[]>([])
  
  // Create app context
  const appContext: AppContext = {
    version: '1.0.0',
    getSession: () => null,
    getSessions: () => [],
    getProviders: () => [],
    getModels: () => [],
    getCurrentProvider: () => null,
    getCurrentModel: () => ''
  }
  
  // Create plugin manager
  const pluginManager = useMemo(() => {
    return new PluginManager(appContext)
  }, [])

  // Initialize plugins
  useEffect(() => {
    const initPlugins = async () => {
      try {
        // Ensure external plugins directory exists
        await ensurePluginsDirectory()

        // Register CORE plugins (always enabled, cannot be disabled)
        await pluginManager.register(new MarkdownRendererPlugin())

        // Register OPTIONAL plugins (can be enabled/disabled by user)
        await pluginManager.register(new MessageExportPlugin())
        
        // Register timestamp plugin
        const timestampPlugin = await createTimestampPlugin()
        await pluginManager.register(timestampPlugin)

        // Load built-in plugins from directories
        await loadBuiltinPlugins(pluginManager)

        // Load external plugins
        await loadExternalPlugins(pluginManager)

        // Update state - get ALL plugins (enabled and disabled)
        // Note: Plugin state is automatically loaded in PluginManager constructor
        setPlugins(pluginManager.getAllPlugins())
      } catch (error) {
        console.error('Failed to initialize plugins:', error)
      }
    }

    initPlugins()
  }, [pluginManager])

  // Load built-in plugins from directories (like timestamp)
  const loadBuiltinPlugins = async (manager: PluginManager) => {
    try {
      // List of built-in plugin directories to load
      const builtinPluginDirs = ['timestamp', 'message-export', 'markdown']
      
      for (const pluginDir of builtinPluginDirs) {
        try {
          // Try to dynamically import the plugin
          const pluginPath = `../plugins/builtin/${pluginDir}/index.js`
          const module = await import(/* @vite-ignore */ pluginPath)
          
          if (module.default) {
            const PluginClass = module.default
            const pluginInstance = new PluginClass()
            await manager.register(pluginInstance)
            console.log(`[Plugins] Registered built-in plugin: ${pluginDir}`)
          }
        } catch (error) {
          // Silently skip plugins that don't exist or fail to load
          console.debug(`[Plugins] Skipped built-in plugin ${pluginDir}:`, error)
        }
      }
    } catch (error) {
      console.error('[Plugins] Failed to load built-in plugins:', error)
    }
  }

  // Load external plugins from the plugins directory
  const loadExternalPlugins = async (manager: PluginManager) => {
    try {
      const { listExternalPlugins, loadExternalPlugin } = await import('../services/externalPluginLoader')
      
      const pluginNames = await listExternalPlugins()
      console.log(`[Plugins] Found ${pluginNames.length} external plugins`)
      
      for (const pluginName of pluginNames) {
        try {
          const plugin = await loadExternalPlugin(pluginName)
          if (plugin) {
            await manager.register(plugin)
            console.log(`[Plugins] Registered external plugin: ${pluginName}`)
          }
        } catch (error) {
          console.error(`[Plugins] Failed to load external plugin ${pluginName}:`, error)
        }
      }
    } catch (error) {
      console.error('[Plugins] Failed to load external plugins:', error)
    }
  }

  const enablePlugin = async (pluginId: string) => {
    try {
      await pluginManager.enable(pluginId)
      setPlugins(pluginManager.getAllPlugins())
    } catch (error) {
      console.error(`Failed to enable plugin ${pluginId}:`, error)
    }
  }

  const disablePlugin = async (pluginId: string) => {
    try {
      await pluginManager.disable(pluginId)
      setPlugins(pluginManager.getAllPlugins())
    } catch (error) {
      console.error(`Failed to disable plugin ${pluginId}:`, error)
    }
  }

  const registerPlugin = async (plugin: BasePlugin) => {
    try {
      await pluginManager.register(plugin)
      setPlugins(pluginManager.getAllPlugins())
    } catch (error) {
      console.error('Failed to register plugin:', error)
    }
  }

  const unregisterPlugin = async (pluginId: string) => {
    try {
      await pluginManager.unregister(pluginId)
      setPlugins(pluginManager.getAllPlugins())
    } catch (error) {
      console.error(`Failed to unregister plugin ${pluginId}:`, error)
    }
  }

  const reloadPlugin = async (pluginId: string) => {
    try {
      await pluginManager.reloadPlugin(pluginId)
      setPlugins(pluginManager.getAllPlugins())
    } catch (error) {
      console.error(`Failed to reload plugin ${pluginId}:`, error)
      throw error // Re-throw to allow UI to handle the error
    }
  }

  return {
    plugins,
    pluginManager,
    enablePlugin,
    disablePlugin,
    registerPlugin,
    unregisterPlugin,
    reloadPlugin,
  }
}
