// Plugin system types - highly modular and extensible

export type PluginType = 
  | 'message-processor'  // Process messages before/after sending
  | 'renderer'           // Render message content (markdown, code, etc.)
  | 'tool'               // Add tools/functions to the chat
  | 'storage'            // Custom storage backends
  | 'ui-extension'       // Add UI components
  | 'reasoning-detector' // Detect reasoning in messages

// Plugin manifest - must be in plugin.json file
export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author: string
  homepage?: string
  repository?: string
  license?: string
  type: PluginType
  appVersion: string  // Minimum OpenChat version required
  dependencies?: string[]  // Other plugin IDs this depends on
  core?: boolean  // If true, plugin is required and cannot be disabled
}

export interface PluginMetadata extends PluginManifest {
  enabled: boolean
  folderPath?: string
}

export interface PluginContext {
  // Access to app state and utilities
  getCurrentSession?: () => any
  getProviders?: () => any
  notify?: (message: string, type?: 'info' | 'success' | 'error') => void
}

export interface BasePlugin {
  metadata: PluginMetadata
  
  // Lifecycle hooks
  onLoad?(context: PluginContext): void | Promise<void>
  onUnload?(): void | Promise<void>
  onEnable?(): void | Promise<void>
  onDisable?(): void | Promise<void>
}

// Message processor plugin - transform messages
export interface MessageProcessorPlugin extends BasePlugin {
  metadata: PluginMetadata & { type: 'message-processor' }
  
  // Process message before sending to provider
  processOutgoing?(content: string): string | Promise<string>
  
  // Process message after receiving from provider
  processIncoming?(content: string): string | Promise<string>
}

// Renderer plugin - render message content
export interface RendererPlugin extends BasePlugin {
  metadata: PluginMetadata & { type: 'renderer' }
  
  // Check if this renderer can handle the content
  canRender(content: string): boolean
  
  // Render the content to React component or HTML
  render(content: string): React.ReactNode | string
}

// Tool plugin - add functions/tools to chat
export interface ToolPlugin extends BasePlugin {
  metadata: PluginMetadata & { type: 'tool' }
  
  // Tool definitions (can provide multiple tools)
  tools: Array<{
    type: 'function'
    function: {
      name: string
      description: string
      parameters: {
        type: 'object'
        properties: Record<string, any>
        required: string[]
      }
    }
  }>
  
  // Execute a tool by name
  executeTool(toolName: string, args: Record<string, any>): any | Promise<any>
}

// Storage plugin - custom storage backends
export interface StoragePlugin extends BasePlugin {
  metadata: PluginMetadata & { type: 'storage' }
  
  save(key: string, data: any): void | Promise<void>
  load(key: string): any | Promise<any>
  delete(key: string): void | Promise<void>
  list(): string[] | Promise<string[]>
}

// UI Extension plugin - add custom UI components
export interface UIExtensionPlugin extends BasePlugin {
  metadata: PluginMetadata & { type: 'ui-extension' }
  
  // Where to render the extension
  location: 'sidebar' | 'toolbar' | 'message-actions' | 'settings' | 'user-message-footer' | 'ai-message-footer'
  
  // The component to render
  component: React.ComponentType<any>
}

// Reasoning Detector plugin - detect reasoning in messages
export interface ReasoningPart {
  type: 'reasoning' | 'text'
  content: string
}

export interface ReasoningDetectorPlugin extends BasePlugin {
  metadata: PluginMetadata & { type: 'reasoning-detector' }
  
  // Parse content and return reasoning parts
  parseReasoning(content: string): ReasoningPart[]
}

export type Plugin = 
  | MessageProcessorPlugin 
  | RendererPlugin 
  | ToolPlugin 
  | StoragePlugin 
  | UIExtensionPlugin
  | ReasoningDetectorPlugin
