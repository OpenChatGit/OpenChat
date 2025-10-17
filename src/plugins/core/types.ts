/**
 * Core Plugin System Types
 * 
 * This file defines all the types and interfaces for the OpenChat plugin system.
 * Plugins can extend any aspect of the application through these well-defined interfaces.
 */

// ============================================================================
// Plugin Types
// ============================================================================

/**
 * All supported plugin types in the system
 */
export type PluginType =
  | 'renderer'           // Render message content (markdown, code, etc.)
  | 'message-processor'  // Transform messages before/after sending
  | 'tool'               // Add AI tools and functions
  | 'ui-extension'       // Add UI components and overlays
  | 'provider'           // Add AI provider integrations
  | 'storage'            // Custom storage backends
  | 'theme'              // Visual themes and styling
  | 'command'            // Slash commands
  | 'shortcut'           // Keyboard shortcuts
  | 'context-menu'       // Right-click menu items

/**
 * Permissions that plugins can request
 */
export type Permission =
  | 'network'            // Access to network resources
  | 'storage'            // Access to persistent storage
  | 'filesystem'         // Access to file system
  | 'clipboard'          // Access to clipboard
  | 'notifications'      // Show system notifications
  | 'system-commands'    // Execute system commands

/**
 * UI locations where extensions can be rendered
 */
export type UILocation =
  | 'sidebar'            // Left sidebar
  | 'toolbar'            // Top toolbar
  | 'message-actions'    // Message action buttons
  | 'settings'           // Settings panel
  | 'chat-input'         // Chat input area
  | 'modal'              // Modal overlay

// ============================================================================
// Plugin Metadata
// ============================================================================

/**
 * Plugin manifest structure (from plugin.json)
 */
export interface PluginManifest {
  /** Unique plugin identifier (lowercase, hyphens only) */
  id: string
  
  /** Display name */
  name: string
  
  /** Semantic version (e.g., "1.0.0") */
  version: string
  
  /** Short description */
  description: string
  
  /** Author name or organization */
  author: string
  
  /** Homepage URL */
  homepage?: string
  
  /** Repository URL */
  repository?: string
  
  /** License identifier (e.g., "MIT") */
  license?: string
  
  /** Plugin type(s) - can be single or array */
  type: PluginType | PluginType[]
  
  /** Minimum app version required (semver range) */
  appVersion: string
  
  /** Plugin IDs this plugin depends on */
  dependencies?: string[]
  
  /** If true, plugin is required and cannot be disabled */
  core?: boolean
  
  /** Permissions required by this plugin */
  permissions?: Permission[]
  
  /** Configuration schema (JSON Schema) */
  config?: Record<string, any>
  
  /** Hook configurations */
  hooks?: Record<string, HookConfig>
}

/**
 * Runtime plugin metadata (manifest + runtime info)
 */
export interface PluginMetadata extends PluginManifest {
  /** Whether plugin is currently enabled */
  enabled: boolean
  
  /** Whether plugin module is loaded */
  loaded: boolean
  
  /** Error message if plugin failed to load */
  error?: string
  
  /** Absolute path to plugin folder */
  folderPath: string
  
  /** Whether this is a built-in plugin */
  isBuiltin: boolean
}

/**
 * Hook configuration
 */
export interface HookConfig {
  /** Execution priority (lower = earlier) */
  priority?: number
  
  /** Whether hook is async */
  async?: boolean
}

// ============================================================================
// Plugin Context
// ============================================================================

/**
 * Context provided to plugins for interacting with the application
 */
export interface PluginContext {
  /** Application state and methods */
  app: AppContext
  
  /** Persistent storage API */
  storage: StorageContext
  
  /** Event bus for inter-plugin communication */
  events: EventBus
  
  /** UI utilities */
  ui: UIContext
  
  /** Logging utilities */
  logger: LoggerContext
  
  /** Get another plugin instance */
  getPlugin: <T extends BasePlugin>(pluginId: string) => T | undefined
  
  /** Get all plugins of a specific type */
  getPlugins: (type?: PluginType) => BasePlugin[]
  
  /** Get plugin configuration */
  getConfig: <T = any>() => T
  
  /** Update plugin configuration */
  setConfig: <T = any>(config: Partial<T>) => void
}

/**
 * Application context
 */
export interface AppContext {
  /** Application version */
  version: string
  
  /** Get current chat session */
  getSession: () => any | null
  
  /** Get all chat sessions */
  getSessions: () => any[]
  
  /** Get all providers */
  getProviders: () => any[]
  
  /** Get all models */
  getModels: () => any[]
  
  /** Get current provider */
  getCurrentProvider: () => any | null
  
  /** Get current model */
  getCurrentModel: () => string
}

/**
 * Storage context
 */
export interface StorageContext {
  /** Get value from storage */
  get: <T>(key: string, defaultValue?: T) => T | undefined
  
  /** Set value in storage */
  set: <T>(key: string, value: T) => void
  
  /** Delete value from storage */
  delete: (key: string) => void
  
  /** Clear all plugin storage */
  clear: () => void
}

/**
 * Event bus interface
 */
export interface EventBus {
  /** Subscribe to an event */
  on: (event: string, listener: EventListener) => () => void
  
  /** Unsubscribe from an event */
  off: (event: string, listener: EventListener) => void
  
  /** Emit an event (async) */
  emit: (event: string, data?: any) => Promise<void>
  
  /** Emit an event (sync) */
  emitSync: (event: string, data?: any) => void
  
  /** Get listener count for an event */
  listenerCount: (event: string) => number
}

/**
 * Event listener function
 */
export type EventListener = (data?: any) => void | Promise<void>

/**
 * UI context
 */
export interface UIContext {
  /** Show a notification */
  notify: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void
  
  /** Show a confirmation dialog */
  confirm: (message: string) => Promise<boolean>
  
  /** Show a prompt dialog */
  prompt: (message: string, defaultValue?: string) => Promise<string | null>
  
  /** Show a modal */
  showModal: (component: React.ComponentType) => void
  
  /** Hide the modal */
  hideModal: () => void
}

/**
 * Logger context
 */
export interface LoggerContext {
  /** Log debug message */
  debug: (message: string, ...args: any[]) => void
  
  /** Log info message */
  info: (message: string, ...args: any[]) => void
  
  /** Log warning message */
  warn: (message: string, ...args: any[]) => void
  
  /** Log error message */
  error: (message: string, ...args: any[]) => void
}

// ============================================================================
// Base Plugin Interface
// ============================================================================

/**
 * Base plugin interface that all plugins must implement
 */
export interface BasePlugin {
  /** Plugin metadata */
  metadata: PluginMetadata
  
  /** Called when plugin is first registered */
  onLoad?(context: PluginContext): void | Promise<void>
  
  /** Called when plugin is unregistered */
  onUnload?(): void | Promise<void>
  
  /** Called when plugin is enabled */
  onEnable?(): void | Promise<void>
  
  /** Called when plugin is disabled */
  onDisable?(): void | Promise<void>
  
  /** Called when plugin configuration changes */
  onConfigChange?(config: any): void | Promise<void>
}

// ============================================================================
// Specific Plugin Type Interfaces
// ============================================================================

/**
 * Renderer Plugin - Renders message content
 */
export interface RendererPlugin extends BasePlugin {
  metadata: PluginMetadata & { type: 'renderer' | PluginType[] }
  
  /** Check if this renderer can handle the content */
  canRender(content: string): boolean
  
  /** Render the content */
  render(content: string): React.ReactNode
  
  /** Priority for checking (higher = checked first) */
  priority?: number
}

/**
 * Message Processor Plugin - Transforms messages
 */
export interface MessageProcessorPlugin extends BasePlugin {
  metadata: PluginMetadata & { type: 'message-processor' | PluginType[] }
  
  /** Process message before sending to AI */
  processOutgoing?(message: string, context: MessageContext): string | Promise<string>
  
  /** Process message after receiving from AI */
  processIncoming?(message: string, context: MessageContext): string | Promise<string>
}

/**
 * Message context for processors
 */
export interface MessageContext {
  sessionId: string
  provider: string
  model: string
  timestamp: number
}

/**
 * Tool Plugin - Adds AI tools/functions
 */
export interface ToolPlugin extends BasePlugin {
  metadata: PluginMetadata & { type: 'tool' | PluginType[] }
  
  /** Get tool definition */
  getTool(): ToolDefinition
  
  /** Execute the tool */
  execute(params: Record<string, any>, context: ToolContext): any | Promise<any>
}

/**
 * Tool definition
 */
export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, any>
}

/**
 * Tool execution context
 */
export interface ToolContext {
  sessionId: string
  messageId: string
}

/**
 * UI Extension Plugin - Adds UI components
 */
export interface UIExtensionPlugin extends BasePlugin {
  metadata: PluginMetadata & { type: 'ui-extension' | PluginType[] }
  
  /** Where to render the extension */
  location: UILocation
  
  /** The component to render */
  component: React.ComponentType<any>
  
  /** Condition for showing the extension */
  condition?: () => boolean
}

/**
 * Provider Plugin - Adds AI providers
 */
export interface ProviderPlugin extends BasePlugin {
  metadata: PluginMetadata & { type: 'provider' | PluginType[] }
  
  /** Get provider configuration */
  getProviderConfig(): any
  
  /** Create provider instance */
  createProvider(): any
}

/**
 * Storage Plugin - Custom storage backend
 */
export interface StoragePlugin extends BasePlugin {
  metadata: PluginMetadata & { type: 'storage' | PluginType[] }
  
  /** Save data */
  save(key: string, data: any): void | Promise<void>
  
  /** Load data */
  load(key: string): any | Promise<any>
  
  /** Delete data */
  delete(key: string): void | Promise<void>
  
  /** List all keys */
  list(): string[] | Promise<string[]>
  
  /** Clear all data */
  clear(): void | Promise<void>
}

/**
 * Theme Plugin - Visual themes
 */
export interface ThemePlugin extends BasePlugin {
  metadata: PluginMetadata & { type: 'theme' | PluginType[] }
  
  /** Get theme definition */
  getTheme(): ThemeDefinition
  
  /** Apply the theme */
  apply(): void
  
  /** Remove the theme */
  remove(): void
}

/**
 * Theme definition
 */
export interface ThemeDefinition {
  id: string
  name: string
  colors: Record<string, string>
  fonts?: Record<string, string>
  styles?: string
}

/**
 * Command Plugin - Slash commands
 */
export interface CommandPlugin extends BasePlugin {
  metadata: PluginMetadata & { type: 'command' | PluginType[] }
  
  /** Get command definition */
  getCommand(): CommandDefinition
  
  /** Execute the command */
  execute(args: string[], context: CommandContext): any | Promise<any>
}

/**
 * Command definition
 */
export interface CommandDefinition {
  name: string
  description: string
  usage: string
  aliases?: string[]
}

/**
 * Command execution context
 */
export interface CommandContext {
  sessionId: string
  input: string
}

/**
 * Shortcut Plugin - Keyboard shortcuts
 */
export interface ShortcutPlugin extends BasePlugin {
  metadata: PluginMetadata & { type: 'shortcut' | PluginType[] }
  
  /** Get shortcut definition */
  getShortcut(): ShortcutDefinition
  
  /** Execute the shortcut */
  execute(event: KeyboardEvent): void | Promise<void>
}

/**
 * Shortcut definition
 */
export interface ShortcutDefinition {
  key: string
  modifiers?: ('ctrl' | 'alt' | 'shift' | 'meta')[]
  description: string
}

/**
 * Context Menu Plugin - Right-click menu items
 */
export interface ContextMenuPlugin extends BasePlugin {
  metadata: PluginMetadata & { type: 'context-menu' | PluginType[] }
  
  /** Get menu item definition */
  getMenuItem(): ContextMenuItem
  
  /** Execute the menu action */
  execute(context: ContextMenuContext): void | Promise<void>
}

/**
 * Context menu item
 */
export interface ContextMenuItem {
  label: string
  icon?: string
  condition?: (context: ContextMenuContext) => boolean
}

/**
 * Context menu execution context
 */
export interface ContextMenuContext {
  target: 'message' | 'session' | 'selection'
  data: any
}

// ============================================================================
// Union Type
// ============================================================================

/**
 * Union of all plugin types
 */
export type Plugin =
  | RendererPlugin
  | MessageProcessorPlugin
  | ToolPlugin
  | UIExtensionPlugin
  | ProviderPlugin
  | StoragePlugin
  | ThemePlugin
  | CommandPlugin
  | ShortcutPlugin
  | ContextMenuPlugin
