/**
 * External Plugin Loader Service
 * 
 * Loads plugins from an external directory outside the app bundle.
 * This allows users to add custom plugins without rebuilding the app.
 */

const PLUGIN_DIR_NAME = 'plugins'

/**
 * Get the external plugins directory path
 * Uses Tauri's app data directory or falls back to a local path
 */
export async function getPluginsDirectory(): Promise<string> {
  try {
    // Check if we're in Tauri
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      const { appDataDir, join } = await import('@tauri-apps/api/path')
      const appData = await appDataDir()
      return await join(appData, PLUGIN_DIR_NAME)
    }
  } catch (error) {
    console.warn('Failed to get Tauri app data dir:', error)
  }
  
  // Fallback for development/browser
  return './plugins'
}

/**
 * Get the bundled plugins directory path (in installation directory)
 * This is where plugins shipped with the installer are located
 */
export async function getBundledPluginsDirectory(): Promise<string | null> {
  try {
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      const { resourceDir, join } = await import('@tauri-apps/api/path')
      const resources = await resourceDir()
      return await join(resources, PLUGIN_DIR_NAME)
    }
  } catch (error) {
    console.warn('Failed to get bundled plugins dir:', error)
  }
  
  return null
}

/**
 * Ensure the plugins directory exists and copy bundled plugins on first run
 */
export async function ensurePluginsDirectory(): Promise<void> {
  try {
    // Check if we're in Tauri
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      const { exists, mkdir } = await import('@tauri-apps/plugin-fs')
      const pluginsDir = await getPluginsDirectory()
      
      const dirExists = await exists(pluginsDir)
      const isFirstRun = !dirExists
      
      if (!dirExists) {
        await mkdir(pluginsDir, { recursive: true })
        console.log('[Plugins] Created plugins directory:', pluginsDir)
      }
      
      // Create README file
      await createPluginReadme(pluginsDir)
      
      // Copy bundled plugins on first run
      if (isFirstRun) {
        await copyBundledPlugins(pluginsDir)
      }
    }
  } catch (error) {
    console.error('Failed to ensure plugins directory:', error)
  }
}

/**
 * Copy bundled plugins from installation directory to user plugins directory
 */
async function copyBundledPlugins(targetDir: string): Promise<void> {
  try {
    const bundledDir = await getBundledPluginsDirectory()
    if (!bundledDir) {
      console.log('[Plugins] No bundled plugins directory found')
      return
    }

    const { exists, readDir, copyFile, mkdir } = await import('@tauri-apps/plugin-fs')
    const { join } = await import('@tauri-apps/api/path')
    
    const bundledExists = await exists(bundledDir)
    if (!bundledExists) {
      console.log('[Plugins] Bundled plugins directory does not exist')
      return
    }

    // Read bundled plugins directory
    const entries = await readDir(bundledDir)
    
    for (const entry of entries) {
      if (entry.isDirectory) {
        const sourcePath = await join(bundledDir, entry.name)
        const targetPath = await join(targetDir, entry.name)
        
        // Create target directory
        await mkdir(targetPath, { recursive: true })
        
        // Copy all files in the plugin directory
        const pluginFiles = await readDir(sourcePath)
        for (const file of pluginFiles) {
          if (file.isFile) {
            const sourceFile = await join(sourcePath, file.name)
            const targetFile = await join(targetPath, file.name)
            await copyFile(sourceFile, targetFile)
            console.log(`[Plugins] Copied bundled plugin file: ${file.name}`)
          }
        }
        
        console.log(`[Plugins] Copied bundled plugin: ${entry.name}`)
      }
    }
  } catch (error) {
    console.error('[Plugins] Failed to copy bundled plugins:', error)
  }
}

/**
 * Create a README file in the plugins directory
 */
async function createPluginReadme(pluginsDir: string): Promise<void> {
  try {
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      const { writeTextFile } = await import('@tauri-apps/plugin-fs')
      const { join } = await import('@tauri-apps/api/path')
      
      const readmePath = await join(pluginsDir, 'README.md')
      
      const content = `# OpenChat Plugins Directory

This directory contains external plugins for OpenChat.

## How to Add Plugins

1. Create a new folder for your plugin (e.g., \`my-plugin\`)
2. Add your plugin files:
   - \`plugin.json\` - Plugin manifest
   - \`index.js\` - Plugin code
3. Restart OpenChat to load the plugin

## Plugin Structure

\`\`\`
plugins/
  my-plugin/
    plugin.json
    index.js
\`\`\`

### plugin.json Example

\`\`\`json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "My custom plugin",
  "author": "Your Name",
  "type": "message-processor",
  "appVersion": ">=0.4.0"
}
\`\`\`

### index.js Example

\`\`\`javascript
// Export a plugin class
export class MyPlugin {
  metadata = {
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
    description: 'My custom plugin',
    type: 'message-processor',
    enabled: true
  }

  processOutgoing(content) {
    // Transform outgoing messages
    return content.toUpperCase()
  }

  onLoad() {
    console.log('My plugin loaded!')
  }
}
\`\`\`

## Plugin Types

- \`renderer\` - Custom content rendering
- \`message-processor\` - Transform messages
- \`tool\` - Add callable tools
- \`ui-extension\` - Add UI components

## Documentation

For full documentation, visit:
https://github.com/OpenChatGit/OpenChat/blob/main/src/plugins/PLUGIN_GUIDE.md
`
      
      await writeTextFile(readmePath, content)
      console.log('[Plugins] Created README.md')
    }
  } catch (error) {
    console.error('Failed to create plugin README:', error)
  }
}

/**
 * List all plugin directories in the external plugins folder
 */
export async function listExternalPlugins(): Promise<string[]> {
  try {
    // Check if we're in Tauri
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      const { readDir, exists } = await import('@tauri-apps/plugin-fs')
      const pluginsDir = await getPluginsDirectory()
      
      const dirExists = await exists(pluginsDir)
      if (!dirExists) {
        return []
      }
      
      const entries = await readDir(pluginsDir)
      
      // Filter for directories only
      return entries
        .filter(entry => entry.isDirectory)
        .map(entry => entry.name)
    }
  } catch (error) {
    console.error('Failed to list external plugins:', error)
  }
  
  return []
}

/**
 * Load a plugin manifest from a plugin directory
 */
export async function loadPluginManifest(pluginName: string): Promise<any | null> {
  try {
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      const { readTextFile, exists } = await import('@tauri-apps/plugin-fs')
      const { join } = await import('@tauri-apps/api/path')
      const pluginsDir = await getPluginsDirectory()
      
      const manifestPath = await join(pluginsDir, pluginName, 'plugin.json')
      const manifestExists = await exists(manifestPath)
      
      if (!manifestExists) {
        console.warn(`[Plugins] No manifest found for ${pluginName}`)
        return null
      }
      
      const content = await readTextFile(manifestPath)
      return JSON.parse(content)
    }
  } catch (error) {
    console.error(`Failed to load manifest for ${pluginName}:`, error)
  }
  
  return null
}

/**
 * Open the plugins directory in the file explorer
 */
export async function openPluginsDirectory(): Promise<void> {
  try {
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
      const pluginsDir = await getPluginsDirectory()
      
      // Ensure directory exists first
      await ensurePluginsDirectory()
      
      // Open in file explorer
      await revealItemInDir(pluginsDir)
    }
  } catch (error) {
    console.error('Failed to open plugins directory:', error)
  }
}

/**
 * Note: Dynamic plugin loading from external JavaScript files is complex
 * and requires careful security considerations. For now, we'll focus on
 * creating the directory structure and documentation.
 * 
 * Future enhancement: Implement safe plugin loading using:
 * - Sandboxed execution environment
 * - Plugin signature verification
 * - Permission system
 */
