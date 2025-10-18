import { useState, useEffect, useMemo } from 'react'
import { PluginManager } from '../plugins/core/PluginManager'
import { MarkdownRendererPlugin } from '../plugins/builtin/markdown-renderer'
import { MessageExportPlugin } from '../plugins/builtin/MessageExportPlugin'
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
        // Register CORE plugins (always enabled, cannot be disabled)
        await pluginManager.register(new MarkdownRendererPlugin())

        // Register OPTIONAL plugins (can be enabled/disabled by user)
        await pluginManager.register(new MessageExportPlugin())

        // Load saved plugin state
        pluginManager.loadPluginState()

        // Update state - get ALL plugins (enabled and disabled)
        setPlugins(pluginManager.getAllPlugins())
      } catch (error) {
        console.error('Failed to initialize plugins:', error)
      }
    }

    initPlugins()
  }, [pluginManager])

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

  return {
    plugins,
    pluginManager,
    enablePlugin,
    disablePlugin,
    registerPlugin,
    unregisterPlugin,
  }
}
