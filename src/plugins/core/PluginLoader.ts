/**
 * Plugin Loader
 * 
 * Handles plugin discovery, loading, and validation.
 * Manages plugin module cache for hot reload functionality.
 * 
 * Supports loading plugins from:
 * - Built-in plugins (bundled with the app)
 * - External plugins (user-created in AppData directory)
 */

import type { PluginMetadata, PluginManifest, BasePlugin } from './types'
import { PluginExecutor } from './PluginExecutor'

export class PluginLoader {
  private cache: Map<string, any> = new Map()
  private metadataCache: Map<string, PluginMetadata> = new Map()
  private executor: PluginExecutor = new PluginExecutor()

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

  // ============================================================================
  // Enhanced Plugin Loading Methods
  // ============================================================================

  /**
   * Load all plugins (built-in + external)
   * @returns Array of loaded plugin instances
   */
  async loadAll(): Promise<BasePlugin[]> {
    console.log('[PluginLoader] Loading all plugins...')
    
    const builtinPlugins = await this.loadBuiltinPlugins()
    const externalPlugins = await this.loadExternalPlugins()
    
    const allPlugins = [...builtinPlugins, ...externalPlugins]
    console.log(`[PluginLoader] Loaded ${allPlugins.length} plugins (${builtinPlugins.length} built-in, ${externalPlugins.length} external)`)
    
    return allPlugins
  }

  /**
   * Load built-in plugins from bundled directory
   * 
   * In development: Load from src/plugins/builtin/
   * In production: Load from bundled resources directory
   * 
   * @returns Array of loaded built-in plugin instances
   */
  async loadBuiltinPlugins(): Promise<BasePlugin[]> {
    console.log('[PluginLoader] Loading built-in plugins...')
    const plugins: BasePlugin[] = []

    try {
      const builtinDir = await this.getBuiltinPluginsDirectory()
      
      if (!builtinDir) {
        console.warn('[PluginLoader] No built-in plugins directory found')
        return plugins
      }

      // Scan for plugin directories
      const pluginDirs = await this.scanPluginDirectory(builtinDir)
      
      console.log(`[PluginLoader] Found ${pluginDirs.length} built-in plugin directories`)

      // Load each plugin
      for (const dir of pluginDirs) {
        try {
          const plugin = await this.loadPlugin(dir, true)
          if (plugin) {
            plugins.push(plugin)
            console.log(`[PluginLoader] Loaded built-in plugin: ${plugin.metadata.id}`)
          }
        } catch (error) {
          console.error(`[PluginLoader] Failed to load built-in plugin from ${dir}:`, error)
        }
      }

    } catch (error) {
      console.error('[PluginLoader] Error loading built-in plugins:', error)
    }

    return plugins
  }

  /**
   * Load external plugins from AppData directory
   * 
   * Gets AppData directory path via Tauri
   * Creates AppData/OpenChat/plugins/ if not exists
   * Scans directory for plugin folders
   * Loads each plugin with error handling
   * 
   * @returns Array of loaded external plugin instances
   */
  async loadExternalPlugins(): Promise<BasePlugin[]> {
    console.log('[PluginLoader] Loading external plugins...')
    const plugins: BasePlugin[] = []

    try {
      // Get external plugins directory (AppData/OpenChat/plugins/)
      const externalDir = await this.getExternalPluginsDirectory()
      
      if (!externalDir) {
        console.warn('[PluginLoader] No external plugins directory available')
        return plugins
      }

      // Ensure directory exists
      await this.ensureDirectory(externalDir)

      // Scan for plugin directories
      const pluginDirs = await this.scanPluginDirectory(externalDir)
      
      console.log(`[PluginLoader] Found ${pluginDirs.length} external plugin directories`)

      // Load each plugin
      for (const dir of pluginDirs) {
        try {
          const plugin = await this.loadPlugin(dir, false)
          if (plugin) {
            plugins.push(plugin)
            console.log(`[PluginLoader] Loaded external plugin: ${plugin.metadata.id}`)
          }
        } catch (error) {
          console.error(`[PluginLoader] Failed to load external plugin from ${dir}:`, error)
        }
      }

    } catch (error) {
      console.error('[PluginLoader] Error loading external plugins:', error)
    }

    return plugins
  }

  /**
   * Load a single plugin from a directory
   * 
   * @param pluginPath - Absolute path to plugin directory
   * @param isBuiltin - Whether this is a built-in plugin
   * @returns Loaded plugin instance or null
   */
  private async loadPlugin(pluginPath: string, isBuiltin: boolean): Promise<BasePlugin | null> {
    try {
      console.log(`[PluginLoader] Loading plugin from: ${pluginPath}`)

      // 1. Read plugin.json manifest
      const manifest = await this.readManifestFromPath(pluginPath)
      if (!manifest) {
        console.error(`[PluginLoader] No manifest found at ${pluginPath}`)
        return null
      }

      // 2. Validate manifest
      if (!this.validateManifest(manifest)) {
        console.error(`[PluginLoader] Invalid manifest for plugin at ${pluginPath}`)
        return null
      }

      // 3. Read plugin code (index.js or index.ts)
      const code = await this.readPluginCode(pluginPath)
      if (!code) {
        console.error(`[PluginLoader] No code found for plugin at ${pluginPath}`)
        return null
      }

      // 4. Execute plugin code and get instance
      const instance = await this.executor.execute(code, manifest)

      // 5. Update metadata
      instance.metadata.folderPath = pluginPath
      instance.metadata.isBuiltin = isBuiltin
      instance.metadata.loaded = true

      // 6. Cache the plugin
      this.cache.set(pluginPath, instance)
      this.metadataCache.set(manifest.id, instance.metadata)

      return instance

    } catch (error) {
      console.error(`[PluginLoader] Error loading plugin from ${pluginPath}:`, error)
      return null
    }
  }

  /**
   * Get built-in plugins directory path
   * 
   * In development: src/plugins/builtin/
   * In production: resources/plugins/ (bundled with app)
   * 
   * @returns Directory path or null
   */
  private async getBuiltinPluginsDirectory(): Promise<string | null> {
    try {
      // Check if we're in Tauri (production build)
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        const { resourceDir, join } = await import('@tauri-apps/api/path')
        const resources = await resourceDir()
        return await join(resources, 'plugins', 'builtin')
      }
      
      // Development mode - use relative path
      return 'src/plugins/builtin'
      
    } catch (error) {
      console.error('[PluginLoader] Error getting built-in plugins directory:', error)
      return null
    }
  }

  /**
   * Get external plugins directory path (AppData/OpenChat/plugins/)
   * 
   * @returns Directory path or null
   */
  private async getExternalPluginsDirectory(): Promise<string | null> {
    try {
      // Check if we're in Tauri
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        const { appDataDir, join } = await import('@tauri-apps/api/path')
        const appData = await appDataDir()
        return await join(appData, 'plugins')
      }
      
      // Fallback for development/browser
      return './plugins'
      
    } catch (error) {
      console.error('[PluginLoader] Error getting external plugins directory:', error)
      return null
    }
  }

  /**
   * Ensure a directory exists, create if it doesn't
   * 
   * @param dirPath - Directory path to ensure
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        const { exists, mkdir } = await import('@tauri-apps/plugin-fs')
        
        const dirExists = await exists(dirPath)
        if (!dirExists) {
          await mkdir(dirPath, { recursive: true })
          console.log(`[PluginLoader] Created directory: ${dirPath}`)
        }
      }
    } catch (error) {
      console.error(`[PluginLoader] Error ensuring directory ${dirPath}:`, error)
    }
  }

  /**
   * Scan a directory for plugin subdirectories
   * 
   * @param dirPath - Directory to scan
   * @returns Array of absolute paths to plugin directories
   */
  private async scanPluginDirectory(dirPath: string): Promise<string[]> {
    const pluginDirs: string[] = []

    try {
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        const { readDir, exists } = await import('@tauri-apps/plugin-fs')
        const { join } = await import('@tauri-apps/api/path')
        
        const dirExists = await exists(dirPath)
        if (!dirExists) {
          return pluginDirs
        }

        const entries = await readDir(dirPath)
        
        // Filter for directories that contain plugin.json
        for (const entry of entries) {
          if (entry.isDirectory) {
            const pluginPath = await join(dirPath, entry.name)
            const manifestPath = await join(pluginPath, 'plugin.json')
            const hasManifest = await exists(manifestPath)
            
            if (hasManifest) {
              pluginDirs.push(pluginPath)
            }
          }
        }
      } else {
        // Development mode - use dynamic import for builtin plugins
        // This is a simplified version for dev mode
        console.log('[PluginLoader] Development mode - scanning builtin plugins')
        
        // For now, return known builtin plugin paths
        // In a real implementation, you'd use Node.js fs here
        const knownBuiltins = ['markdown-renderer']
        for (const name of knownBuiltins) {
          pluginDirs.push(`${dirPath}/${name}`)
        }
      }

    } catch (error) {
      console.error(`[PluginLoader] Error scanning directory ${dirPath}:`, error)
    }

    return pluginDirs
  }

  /**
   * Read plugin manifest from a directory
   * 
   * @param pluginPath - Path to plugin directory
   * @returns Parsed manifest or null
   */
  private async readManifestFromPath(pluginPath: string): Promise<PluginManifest | null> {
    try {
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        const { readTextFile, exists } = await import('@tauri-apps/plugin-fs')
        const { join } = await import('@tauri-apps/api/path')
        
        const manifestPath = await join(pluginPath, 'plugin.json')
        const manifestExists = await exists(manifestPath)
        
        if (!manifestExists) {
          return null
        }
        
        const content = await readTextFile(manifestPath)
        return JSON.parse(content)
      } else {
        // Development mode - try to import the manifest
        try {
          // Dynamic import for development
          const manifestModule = await import(/* @vite-ignore */ `${pluginPath}/plugin.json`)
          return manifestModule.default || manifestModule
        } catch (error) {
          console.error(`[PluginLoader] Error importing manifest from ${pluginPath}:`, error)
          return null
        }
      }
    } catch (error) {
      console.error(`[PluginLoader] Error reading manifest from ${pluginPath}:`, error)
      return null
    }
  }

  /**
   * Read plugin code from a directory
   * Supports both .js and .ts files
   * 
   * @param pluginPath - Path to plugin directory
   * @returns Plugin code as string or null
   */
  private async readPluginCode(pluginPath: string): Promise<string | null> {
    try {
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        const { readTextFile, exists } = await import('@tauri-apps/plugin-fs')
        const { join } = await import('@tauri-apps/api/path')
        
        // Try index.js first, then index.ts
        const possibleFiles = ['index.js', 'index.ts', 'index.tsx']
        
        for (const filename of possibleFiles) {
          const codePath = await join(pluginPath, filename)
          const codeExists = await exists(codePath)
          
          if (codeExists) {
            const code = await readTextFile(codePath)
            console.log(`[PluginLoader] Read code from ${filename}`)
            return code
          }
        }
        
        return null
      } else {
        // Development mode - try to import the module
        try {
          // For development, we need to import the actual module
          // This is a placeholder - in real dev mode, the module would be imported differently
          const possibleFiles = ['index.tsx', 'index.ts', 'index.js']
          
          for (const filename of possibleFiles) {
            try {
              const modulePath = `${pluginPath}/${filename}`
              const module = await import(/* @vite-ignore */ modulePath)
              
              // Convert the module to code string (this is a workaround for dev mode)
              // In production, we read the actual file content
              return `export default ${module.default?.toString() || module.toString()}`
            } catch {
              continue
            }
          }
          
          return null
        } catch (error) {
          console.error(`[PluginLoader] Error importing code from ${pluginPath}:`, error)
          return null
        }
      }
    } catch (error) {
      console.error(`[PluginLoader] Error reading code from ${pluginPath}:`, error)
      return null
    }
  }
}
