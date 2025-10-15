import { useState, useEffect, useMemo } from 'react'
import { PluginManager } from '../plugins/PluginManager'
import { MarkdownRendererPlugin } from '../plugins/core/markdown-renderer'
import { MessageExportPlugin } from '../plugins/optional/message-export'
import { WebSearchToolPlugin } from '../global_tools/web-search/plugin'
import type { Plugin, PluginContext } from '../plugins/types'
import { loadLocal, saveLocal } from '../lib/utils'

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

      // Restore persisted enabled states
      const persisted = loadLocal<Record<string, boolean>>('oc.plugins.enabled', {})
      pluginManager.getAll().forEach(async (p) => {
        const desired = persisted[p.metadata.id]
        if (typeof desired === 'boolean' && desired !== p.metadata.enabled) {
          if (desired) await pluginManager.enable(p.metadata.id)
          else await pluginManager.disable(p.metadata.id)
        }
      })

      // Update state
      setPlugins(pluginManager.getAll())
    }

    initPlugins()
  }, [pluginManager])

  const enablePlugin = async (pluginId: string) => {
    await pluginManager.enable(pluginId)
    const list = pluginManager.getAll()
    setPlugins(list)
    const map: Record<string, boolean> = {}
    list.forEach(p => { map[p.metadata.id] = !!p.metadata.enabled })
    saveLocal('oc.plugins.enabled', map)
  }

  const disablePlugin = async (pluginId: string) => {
    await pluginManager.disable(pluginId)
    const list = pluginManager.getAll()
    setPlugins(list)
    const map: Record<string, boolean> = {}
    list.forEach(p => { map[p.metadata.id] = !!p.metadata.enabled })
    saveLocal('oc.plugins.enabled', map)
  }

  const registerPlugin = async (plugin: Plugin) => {
    await pluginManager.register(plugin)
    const list = pluginManager.getAll()
    setPlugins(list)
    const map: Record<string, boolean> = {}
    list.forEach(p => { map[p.metadata.id] = !!p.metadata.enabled })
    saveLocal('oc.plugins.enabled', map)
  }

  const unregisterPlugin = async (pluginId: string) => {
    await pluginManager.unregister(pluginId)
    const list = pluginManager.getAll()
    setPlugins(list)
    const map: Record<string, boolean> = {}
    list.forEach(p => { map[p.metadata.id] = !!p.metadata.enabled })
    saveLocal('oc.plugins.enabled', map)
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
