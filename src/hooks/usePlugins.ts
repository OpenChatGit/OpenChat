import { useState, useEffect, useMemo } from 'react'
import { PluginManager } from '../plugins/PluginManager'
import { loadAllPlugins } from '../plugins/loader'
import type { Plugin, PluginContext } from '../plugins/types'

export function usePlugins() {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [loading, setLoading] = useState(true)
  
  // Create plugin manager with context
  const pluginManager = useMemo(() => {
    const context: PluginContext = {
      notify: (message: string, type = 'info') => {
        console.log(`[${type.toUpperCase()}] ${message}`)
      },
    }
    
    return new PluginManager(context)
  }, [])

  // Initialize plugins with auto-discovery
  useEffect(() => {
    const initPlugins = async () => {
      try {
        setLoading(true)
        
        // Auto-discover and load all plugins
        const { core, external } = await loadAllPlugins()
        
        // Register CORE plugins (always enabled, cannot be disabled)
        console.log('[Plugin System] Registering core plugins...')
        for (const plugin of core) {
          await pluginManager.register(plugin)
        }

        // Register EXTERNAL plugins (can be enabled/disabled by user)
        console.log('[Plugin System] Registering external plugins...')
        for (const plugin of external) {
          await pluginManager.register(plugin)
        }

        // Update state
        setPlugins(pluginManager.getAll())
        console.log(`[Plugin System] Initialized ${pluginManager.getAll().length} plugin(s)`)
      } catch (error) {
        console.error('[Plugin System] Failed to initialize plugins:', error)
      } finally {
        setLoading(false)
      }
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
    loading,
    enablePlugin,
    disablePlugin,
    registerPlugin,
    unregisterPlugin,
  }
}
