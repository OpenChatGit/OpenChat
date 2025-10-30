/**
 * Plugin API Module
 * 
 * Exports all plugin API components and types.
 */

// Main API
export { createPluginAPI, cleanupPluginAPI } from './PluginAPI'
export type { IPluginAPI, PluginInfo, Session, Message, SessionAPI, MessageAPI } from './PluginAPI'

// Individual APIs
export { HooksAPI } from './HooksAPI'
export { StorageAPI } from './StorageAPI'
export { UIAPI, uiStateManager } from './UIAPI'
export type { NotificationType, ToolbarButton } from './UIAPI'
export { ConfigAPI } from './ConfigAPI'
export type { ConfigField, ConfigSchema } from './ConfigAPI'

// Re-export hook types from core
export type { HookType, HookHandler, HookContext } from '../core/PluginHooks'
