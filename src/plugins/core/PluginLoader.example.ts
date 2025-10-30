/**
 * PluginLoader Usage Examples
 * 
 * This file demonstrates how to use the enhanced PluginLoader
 * to load both built-in and external plugins.
 */

import { PluginLoader } from './PluginLoader'

// ============================================================================
// Example 1: Load All Plugins
// ============================================================================

async function loadAllPluginsExample() {
  const loader = new PluginLoader()
  
  // Load all plugins (built-in + external)
  const plugins = await loader.loadAll()
  
  console.log(`Loaded ${plugins.length} plugins:`)
  plugins.forEach(plugin => {
    console.log(`- ${plugin.metadata.name} v${plugin.metadata.version} (${plugin.metadata.isBuiltin ? 'built-in' : 'external'})`)
  })
  
  return plugins
}

// ============================================================================
// Example 2: Load Only Built-in Plugins
// ============================================================================

async function loadBuiltinPluginsExample() {
  const loader = new PluginLoader()
  
  // Load only built-in plugins
  const builtinPlugins = await loader.loadBuiltinPlugins()
  
  console.log(`Loaded ${builtinPlugins.length} built-in plugins:`)
  builtinPlugins.forEach(plugin => {
    console.log(`- ${plugin.metadata.name} v${plugin.metadata.version}`)
  })
  
  return builtinPlugins
}

// ============================================================================
// Example 3: Load Only External Plugins
// ============================================================================

async function loadExternalPluginsExample() {
  const loader = new PluginLoader()
  
  // Load only external plugins from AppData/OpenChat/plugins/
  const externalPlugins = await loader.loadExternalPlugins()
  
  console.log(`Loaded ${externalPlugins.length} external plugins:`)
  externalPlugins.forEach(plugin => {
    console.log(`- ${plugin.metadata.name} v${plugin.metadata.version}`)
  })
  
  return externalPlugins
}

// ============================================================================
// Example 4: Load Plugins and Call Lifecycle Methods
// ============================================================================

async function loadAndInitializePlugins() {
  const loader = new PluginLoader()
  
  // Load all plugins
  const plugins = await loader.loadAll()
  
  // Note: In a real implementation, you would need to create a PluginContext
  // with app state, storage, events, etc. This is just a simplified example.
  console.log(`Loaded ${plugins.length} plugins`)
  
  // Plugins are loaded but not initialized yet
  // Initialization happens in PluginManager with proper context
  
  return plugins
}

// ============================================================================
// Example 5: Filter Plugins by Type
// ============================================================================

async function loadPluginsByType(type: string) {
  const loader = new PluginLoader()
  
  // Load all plugins
  const allPlugins = await loader.loadAll()
  
  // Filter by type
  const filteredPlugins = allPlugins.filter(plugin => {
    const types = Array.isArray(plugin.metadata.type) 
      ? plugin.metadata.type 
      : [plugin.metadata.type]
    return types.includes(type as any)
  })
  
  console.log(`Found ${filteredPlugins.length} plugins of type "${type}":`)
  filteredPlugins.forEach(plugin => {
    console.log(`- ${plugin.metadata.name}`)
  })
  
  return filteredPlugins
}

// ============================================================================
// Example 6: Handle Plugin Loading Errors
// ============================================================================

async function loadPluginsWithErrorHandling() {
  const loader = new PluginLoader()
  
  try {
    // Load all plugins
    const plugins = await loader.loadAll()
    
    // Separate successful and failed plugins
    const successful = plugins.filter(p => !p.metadata.error)
    const failed = plugins.filter(p => p.metadata.error)
    
    console.log(`✓ Successfully loaded: ${successful.length} plugins`)
    console.log(`✗ Failed to load: ${failed.length} plugins`)
    
    if (failed.length > 0) {
      console.log('\nFailed plugins:')
      failed.forEach(plugin => {
        console.log(`- ${plugin.metadata.id}: ${plugin.metadata.error}`)
      })
    }
    
    return { successful, failed }
    
  } catch (error) {
    console.error('Critical error loading plugins:', error)
    return { successful: [], failed: [] }
  }
}

// ============================================================================
// Example 7: Get Plugin Metadata
// ============================================================================

async function getPluginMetadata() {
  const loader = new PluginLoader()
  
  // Load all plugins
  await loader.loadAll()
  
  // Get all metadata
  const allMetadata = loader.getAllMetadata()
  
  console.log('Plugin Metadata:')
  allMetadata.forEach(metadata => {
    console.log(`
ID: ${metadata.id}
Name: ${metadata.name}
Version: ${metadata.version}
Type: ${metadata.type}
Built-in: ${metadata.isBuiltin}
Enabled: ${metadata.enabled}
Loaded: ${metadata.loaded}
    `)
  })
  
  return allMetadata
}

// ============================================================================
// Example 8: Resolve Plugin Dependencies
// ============================================================================

async function loadPluginsWithDependencies() {
  const loader = new PluginLoader()
  
  // Load all plugins
  const plugins = await loader.loadAll()
  
  // Get metadata for dependency resolution
  const metadata = plugins.map(p => p.metadata)
  
  try {
    // Resolve dependencies and get load order
    const orderedMetadata = loader.resolveDependencies(metadata)
    
    console.log('Plugin load order (respecting dependencies):')
    orderedMetadata.forEach((meta, index) => {
      console.log(`${index + 1}. ${meta.name}`)
      if (meta.dependencies && meta.dependencies.length > 0) {
        console.log(`   Dependencies: ${meta.dependencies.join(', ')}`)
      }
    })
    
    return orderedMetadata
    
  } catch (error) {
    console.error('Dependency resolution failed:', error)
    return []
  }
}

// ============================================================================
// Export Examples
// ============================================================================

export {
  loadAllPluginsExample,
  loadBuiltinPluginsExample,
  loadExternalPluginsExample,
  loadAndInitializePlugins,
  loadPluginsByType,
  loadPluginsWithErrorHandling,
  getPluginMetadata,
  loadPluginsWithDependencies
}
