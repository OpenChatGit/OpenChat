/**
 * Plugin API
 * 
 * Main API interface that plugins use to interact with OpenChat.
 * This is the global `pluginAPI` object injected into plugin code.
 */

import { HooksAPI } from './HooksAPI'
import { StorageAPI } from './StorageAPI'
import { UIAPI } from './UIAPI'
import { ConfigAPI } from './ConfigAPI'
import type { PluginManifest } from '../core/types'

/**
 * Plugin information
 */
export interface PluginInfo {
  id: string
  name: string
  version: string
  enabled: boolean
}

/**
 * Session information
 */
export interface Session {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

/**
 * Message information
 */
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

/**
 * Session API interface
 */
export interface SessionAPI {
  getCurrent(): Session | null
  getAll(): Session[]
  create(title: string): Session
  delete(id: string): void
}

/**
 * Message API interface
 */
export interface MessageAPI {
  send(content: string): Promise<void>
  getHistory(): Message[]
  onReceive(handler: (message: Message) => void): void
}

/**
 * Main Plugin API interface
 */
export interface IPluginAPI {
  // Core APIs
  hooks: HooksAPI
  storage: StorageAPI
  ui: UIAPI
  config: ConfigAPI
  
  // Session & Message APIs (to be implemented)
  session: SessionAPI
  message: MessageAPI
  
  // Plugin info
  plugin: PluginInfo
}

/**
 * Create a PluginAPI instance for a specific plugin
 * 
 * @param pluginId - Unique plugin identifier
 * @param manifest - Plugin manifest from plugin.json
 * @returns PluginAPI instance
 */
export function createPluginAPI(
  pluginId: string,
  manifest: PluginManifest
): IPluginAPI {
  // Create API instances
  const hooks = new HooksAPI(pluginId)
  const storage = new StorageAPI(pluginId)
  const ui = new UIAPI(pluginId)
  const config = new ConfigAPI(pluginId, manifest)

  // Plugin info
  const plugin: PluginInfo = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    enabled: true // Will be updated by PluginManager
  }

  // Session API (placeholder - to be implemented)
  const session: SessionAPI = {
    getCurrent: () => {
      console.warn('[PluginAPI] session.getCurrent() not yet implemented')
      return null
    },
    getAll: () => {
      console.warn('[PluginAPI] session.getAll() not yet implemented')
      return []
    },
    create: (title: string) => {
      console.warn('[PluginAPI] session.create() not yet implemented')
      return {
        id: '',
        title,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    },
    delete: (_id: string) => {
      console.warn('[PluginAPI] session.delete() not yet implemented')
    }
  }

  // Message API (placeholder - to be implemented)
  const message: MessageAPI = {
    send: async (_content: string) => {
      console.warn('[PluginAPI] message.send() not yet implemented')
    },
    getHistory: () => {
      console.warn('[PluginAPI] message.getHistory() not yet implemented')
      return []
    },
    onReceive: (_handler: (message: Message) => void) => {
      console.warn('[PluginAPI] message.onReceive() not yet implemented')
    }
  }

  // Return the complete API
  return {
    hooks,
    storage,
    ui,
    config,
    session,
    message,
    plugin
  }
}

/**
 * Cleanup function to be called when plugin is unloaded
 * 
 * @param api - PluginAPI instance to cleanup
 */
export function cleanupPluginAPI(api: IPluginAPI): void {
  // Unregister all hooks
  api.hooks.unregisterAll()
  
  // Remove all toolbar buttons
  api.ui.removeAllToolbarButtons()
  
  console.log(`[PluginAPI] Cleaned up API for plugin: ${api.plugin.id}`)
}

// Export types
export type { HooksAPI, StorageAPI, UIAPI, ConfigAPI }
