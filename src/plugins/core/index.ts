/**
 * Plugin System Core
 * 
 * Central exports for the OpenChat plugin system
 */

// Core classes
export { PluginManager } from './PluginManager'
export { PluginLoader } from './PluginLoader'
export { PluginSecurity } from './PluginSecurity'
export { EventBus } from './EventBus'
export { pluginHooks } from './PluginHooks'
export { PluginExecutor, pluginExecutor } from './PluginExecutor'

// Types
export * from './types'
export * from './PluginHooks'

// Error classes
export {
  PluginExecutionError,
  PluginValidationError,
  PluginSyntaxError
} from './PluginExecutor'
