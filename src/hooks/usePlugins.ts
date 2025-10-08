import { useState, useEffect, useMemo } from 'react'
import { PluginManager } from '../plugins/PluginManager'
import { MarkdownRendererPlugin } from '../plugins/core/markdown-renderer'
import { MessageExportPlugin } from '../plugins/optional/message-export'
import { WebSearchToolPlugin } from '../global_tools/web-search/plugin'
import type { Plugin, PluginContext } from '../plugins/types'

export function usePlugins() {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  
  // Create plugin manager with context
  const pluginManager = useMemo(() => {
    const context: PluginContext = {
      notify: (message: string, type = 'info') => {
        console.log(`[${type.toUpperCase()}] ${message}`)
      },
    }
    
    return new PluginManager(context)
  }, [])

  // Initialize plugins
  useEffect(() => {
    const initPlugins = async () => {
      // Register CORE plugins (always enabled, cannot be disabled)
      await pluginManager.register(new MarkdownRendererPlugin())

      // Register OPTIONAL plugins (can be enabled/disabled by user)
      await pluginManager.register(new MessageExportPlugin())

      // Register GLOBAL TOOLS (available to all users)
      await pluginManager.register(new WebSearchToolPlugin())

      // Update state
      setPlugins(pluginManager.getAll())
    }

    initPlugins()
  }, [pluginManager])

  const enablePlugin = async (pluginId: string) => {
    await pluginManager.enable(pluginId)
    setPlugins(pluginManager.getAll())
  }

  const disablePlugin = async (pluginId: string) => {
    await pluginManager.disable(pluginId)
    setPlugins(pluginManager.getAll())
  }

  const registerPlugin = async (plugin: Plugin) => {
    await pluginManager.register(plugin)
    setPlugins(pluginManager.getAll())
  }

  const unregisterPlugin = async (pluginId: string) => {
    await pluginManager.unregister(pluginId)
    setPlugins(pluginManager.getAll())
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
