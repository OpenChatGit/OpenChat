/**
 * Plugin Loader
 * 
 * Handles plugin discovery, loading, and validation.
 * Manages plugin module cache for hot reload functionality.
 */

import type { PluginMetadata, PluginManifest } from './types'

export class PluginLoader {
  private cache: Map<string, any> = new Map()
  private metadataCache: Map<string, PluginMetadata> = new Map()

  /**
   * Register a plugin with its metadata
   * @param pluginPath Plugin folder path
   * @param manifest Plugin manifest
   * @param module Plugin module
   * @returns Plugin metadata
   */
  registerPlugin(
    pluginPath: string,
    manifest: PluginManifest,
    module: any
  ): PluginMetadata {
    // Validate manifest
    if (!this.validateManifest(manifest)) {
      throw new Error(`Invalid plugin manifest for ${pluginPath}`)
    }

    // Create metadata
    const metadata: PluginMetadata = {
      ...manifest,
      enabled: false,
      loaded: false,
      folderPath: pluginPath,
      isBuiltin: pluginPath.includes('/builtin/') || pluginPath.includes('\\builtin\\')
    }

    // Cache module and metadata
    this.cache.set(pluginPath, module)
    this.metadataCache.set(manifest.id, metadata)

    return metadata
  }

  /**
   * Get plugin module from cache
   * @param pluginPath Plugin folder path
   * @returns Plugin module or undefined
   */
  getModule(pluginPath: string): any {
    return this.cache.get(pluginPath)
  }

  /**
   * Get plugin metadata by ID
   * @param pluginId Plugin ID
   * @returns Plugin metadata or undefined
   */
  getMetadata(pluginId: string): PluginMetadata | undefined {
    return this.metadataCache.get(pluginId)
  }

  /**
   * Get all cached metadata
   * @returns Array of plugin metadata
   */
  getAllMetadata(): PluginMetadata[] {
    return Array.from(this.metadataCache.values())
  }

  /**
   * Clear cache for a specific plugin (for hot reload)
   * @param pluginPath Plugin folder path
   */
  clearCache(pluginPath: string): void {
    this.cache.delete(pluginPath)
    
    // Also clear metadata cache
    const metadata = Array.from(this.metadataCache.values()).find(
      m => m.folderPath === pluginPath
    )
    if (metadata) {
      this.metadataCache.delete(metadata.id)
    }
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.cache.clear()
    this.metadataCache.clear()
  }

  /**
   * Validate plugin manifest structure
   * @param manifest Plugin manifest to validate
   * @returns True if valid
   */
  validateManifest(manifest: any): manifest is PluginManifest {
    const required = ['id', 'name', 'version', 'description', 'author', 'type', 'appVersion']
    
    // Check required fields
    for (const field of required) {
      if (!(field in manifest)) {
        console.error(`Plugin manifest missing required field: ${field}`)
        return false
      }
    }

    // Validate ID format (lowercase, hyphens only)
    if (!/^[a-z0-9-]+$/.test(manifest.id)) {
      console.error(`Plugin ID must be lowercase with hyphens only: ${manifest.id}`)
      return false
    }

    // Validate version format (semver)
    if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
      console.error(`Plugin version must be semver format: ${manifest.version}`)
      return false
    }

    // Validate type
    const validTypes = [
      'renderer',
      'message-processor',
      'tool',
      'ui-extension',
      'provider',
      'storage',
      'theme',
      'command',
      'shortcut',
      'context-menu'
    ]

    const types = Array.isArray(manifest.type) ? manifest.type : [manifest.type]
    for (const type of types) {
      if (!validTypes.includes(type)) {
        console.error(`Invalid plugin type: ${type}`)
        return false
      }
    }

    return true
  }

  /**
   * Resolve plugin dependencies and return load order
   * Uses topological sort to handle dependencies
   * @param plugins Array of plugin metadata
   * @returns Plugins in dependency order
   * @throws Error if circular dependency detected or dependency missing
   */
  resolveDependencies(plugins: PluginMetadata[]): PluginMetadata[] {
    const resolved: PluginMetadata[] = []
    const visited = new Set<string>()
    const visiting = new Set<string>()
    
    const pluginMap = new Map(plugins.map(p => [p.id, p]))
    
    const visit = (plugin: PluginMetadata) => {
      // Already processed
      if (visited.has(plugin.id)) {
        return
      }
      
      // Circular dependency detected
      if (visiting.has(plugin.id)) {
        throw new Error(`Circular dependency detected: ${plugin.id}`)
      }
      
      visiting.add(plugin.id)
      
      // Visit dependencies first
      if (plugin.dependencies && plugin.dependencies.length > 0) {
        for (const depId of plugin.dependencies) {
          const dep = pluginMap.get(depId)
          
          if (!dep) {
            throw new Error(
              `Dependency not found: ${depId} (required by ${plugin.id})`
            )
          }
          
          visit(dep)
        }
      }
      
      visiting.delete(plugin.id)
      visited.add(plugin.id)
      resolved.push(plugin)
    }
    
    // Visit all plugins
    for (const plugin of plugins) {
      visit(plugin)
    }
    
    return resolved
  }

  /**
   * Check if a plugin satisfies app version requirement
   * @param pluginVersion Required version (semver range)
   * @param appVersion Current app version
   * @returns True if compatible
   */
  checkVersionCompatibility(pluginVersion: string, appVersion: string): boolean {
    // Simple version check - can be enhanced with semver library
    // For now, just check if app version starts with the required version
    
    // Handle >= operator
    if (pluginVersion.startsWith('>=')) {
      const required = pluginVersion.substring(2).trim()
      return this.compareVersions(appVersion, required) >= 0
    }
    
    // Handle > operator
    if (pluginVersion.startsWith('>')) {
      const required = pluginVersion.substring(1).trim()
      return this.compareVersions(appVersion, required) > 0
    }
    
    // Handle exact version
    return appVersion.startsWith(pluginVersion)
  }

  /**
   * Compare two semver versions
   * @param v1 First version
   * @param v2 Second version
   * @returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number)
    const parts2 = v2.split('.').map(Number)
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0
      const p2 = parts2[i] || 0
      
      if (p1 < p2) return -1
      if (p1 > p2) return 1
    }
    
    return 0
  }
}
