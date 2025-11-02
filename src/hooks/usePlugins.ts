import { useState, useEffect, useMemo } from 'react'
import { PluginManager } from '../plugins/core/PluginManager'
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
        console.log('[usePlugins] Starting plugin initialization...')
        
        // Ensure external plugins directory exists
        await ensurePluginsDirectory()

        // Use PluginManager's loadAllPlugins method which uses PluginLoader
        await pluginManager.loadAllPlugins()

        // Update state - get ALL plugins (enabled and disabled)
        const allPlugins = pluginManager.getAllPlugins()
        console.log(`[usePlugins] Loaded ${allPlugins.length} plugins:`, allPlugins.map(p => ({
          id: p.metadata.id,
          name: p.metadata.name,
          enabled: p.metadata.enabled,
          isBuiltin: p.metadata.isBuiltin
        })))
        
        setPlugins(allPlugins)
      } catch (error) {
        console.error('[usePlugins] Failed to initialize plugins:', error)
      }
    }

    initPlugins()
  }, [pluginManager])



  const enablePlugin = async (pluginId: string) => {
    try {
      console.log(`[usePlugins] Enabling plugin: ${pluginId}`)
      await pluginManager.enable(pluginId)
      setPlugins(pluginManager.getAllPlugins())
    } catch (error) {
      console.error(`[usePlugins] Failed to enable plugin ${pluginId}:`, error)
      throw error
    }
  }

  const disablePlugin = async (pluginId: string) => {
    try {
      console.log(`[usePlugins] Disabling plugin: ${pluginId}`)
      await pluginManager.disable(pluginId)
      setPlugins(pluginManager.getAllPlugins())
    } catch (error) {
      console.error(`[usePlugins] Failed to disable plugin ${pluginId}:`, error)
      throw error
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
      console.log(`[usePlugins] Reloading plugin: ${pluginId}`)
      await pluginManager.reloadPlugin(pluginId)
      setPlugins(pluginManager.getAllPlugins())
      console.log(`[usePlugins] Plugin ${pluginId} reloaded successfully`)
    } catch (error) {
      console.error(`[usePlugins] Failed to reload plugin ${pluginId}:`, error)
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
