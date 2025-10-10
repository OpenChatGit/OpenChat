// Plugin Auto-Discovery Loader
// Automatically discovers and loads plugins from core/ and external/ directories

import type { Plugin } from './types'

/**
 * Dynamically imports all plugins from a directory
 * @param modules - Vite's import.meta.glob result
 * @returns Array of plugin instances
 */
async function loadPluginsFromModules(
  modules: Record<string, () => Promise<any>>
): Promise<Plugin[]> {
  const plugins: Plugin[] = []

  for (const [path, importFn] of Object.entries(modules)) {
    try {
      // Skip non-index files and non-plugin directories
      if (!path.includes('/index.ts') && !path.includes('/index.tsx')) {
        continue
      }

      // Skip template and example directories
      if (path.includes('PLUGIN_TEMPLATE') || path.includes('/examples/')) {
        continue
      }

      const module = await importFn()
      
      // Find the plugin class in the module
      // Try to instantiate each exported class and check if it has metadata
      for (const exp of Object.values(module)) {
        if (typeof exp === 'function' && exp.prototype) {
          try {
            const instance = new (exp as any)()
            if (instance && typeof instance === 'object' && 'metadata' in instance) {
              plugins.push(instance)
              console.log(`[Plugin Loader] Discovered: ${instance.metadata.name} v${instance.metadata.version}`)
              break // Only take the first valid plugin from each file
            }
          } catch (e) {
            // Not a plugin class, continue
          }
        }
      }
    } catch (error) {
      console.error(`[Plugin Loader] Failed to load plugin from ${path}:`, error)
    }
  }

  return plugins
}

/**
 * Auto-discover and load all core plugins
 */
export async function loadCorePlugins(): Promise<Plugin[]> {
  // Use Vite's import.meta.glob to dynamically import all plugin files
  const coreModules = import.meta.glob('./core/**/index.{ts,tsx}')
  
  const plugins = await loadPluginsFromModules(coreModules)
  console.log(`[Plugin Loader] Loaded ${plugins.length} core plugin(s)`)
  
  return plugins
}

/**
 * Auto-discover and load all external plugins
 */
export async function loadExternalPlugins(): Promise<Plugin[]> {
  // Use Vite's import.meta.glob to dynamically import all plugin files
  const externalModules = import.meta.glob('./external/**/index.{ts,tsx}')
  
  const plugins = await loadPluginsFromModules(externalModules)
  console.log(`[Plugin Loader] Loaded ${plugins.length} external plugin(s)`)
  
  return plugins
}

/**
 * Load all plugins (core + external)
 */
export async function loadAllPlugins(): Promise<{
  core: Plugin[]
  external: Plugin[]
}> {
  const [core, external] = await Promise.all([
    loadCorePlugins(),
    loadExternalPlugins(),
  ])

  return { core, external }
}
