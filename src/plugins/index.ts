// Plugin system exports

export * from './types'
export { PluginManager } from './PluginManager'

// Core plugins (cannot be disabled)
export * from './core'

// External plugins (can be disabled)
export * from './external'
