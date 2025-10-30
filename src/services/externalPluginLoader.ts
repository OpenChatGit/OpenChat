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

## 🚀 Quick Start - Create Your First Plugin

### Step 1: Create Plugin Folder
Create a new folder with your plugin name (e.g., \`my-awesome-plugin\`)

### Step 2: Create plugin.json
\`\`\`json
{
  "id": "my-awesome-plugin",
  "name": "My Awesome Plugin",
  "version": "1.0.0",
  "description": "Does something awesome",
  "author": "Your Name",
  "type": "message-processor",
  "appVersion": ">=0.5.0"
}
\`\`\`

### Step 3: Create index.js (or index.ts)
\`\`\`javascript
// Simple plugin that transforms messages
class MyAwesomePlugin {
  metadata = {
    id: 'my-awesome-plugin',
    name: 'My Awesome Plugin',
    version: '1.0.0',
    description: 'Does something awesome',
    type: 'message-processor',
    enabled: true
  }

  // Transform outgoing messages (before sending to AI)
  processOutgoing(content) {
    console.log('Processing outgoing message:', content)
    return content // Return modified content
  }

  // Transform incoming messages (from AI)
  processIncoming(content) {
    console.log('Processing incoming message:', content)
    return content // Return modified content
  }

  // Called when plugin is loaded
  onLoad() {
    console.log('My Awesome Plugin loaded!')
  }

  // Called when plugin is unloaded
  onUnload() {
    console.log('My Awesome Plugin unloaded!')
  }
}

// Export the plugin (works in both dev and production)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MyAwesomePlugin
}
\`\`\`

### Step 4: Restart OpenChat
Your plugin will be automatically loaded!

## 📁 Plugin Structure

\`\`\`
plugins/
  my-awesome-plugin/
    plugin.json       ← Plugin metadata
    index.js          ← Plugin code (or index.ts)
    README.md         ← Optional documentation
\`\`\`

## 🎨 Plugin Types

### 1. Message Processor
Transform messages before/after sending
\`\`\`javascript
type: "message-processor"

processOutgoing(content) { return content }
processIncoming(content) { return content }
\`\`\`

### 2. Renderer
Custom content rendering
\`\`\`javascript
type: "renderer"

canRender(content) { return true/false }
render(content) { return JSX }
\`\`\`

### 3. Tool
Add callable tools for AI
\`\`\`javascript
type: "tool"

getTools() { return [{ name, description, execute }] }
\`\`\`

### 4. UI Extension
Add custom UI components
\`\`\`javascript
type: "ui-extension"

getComponents() { return [{ id, component }] }
\`\`\`

## 💡 Tips

- **Use console.log()** for debugging
- **Test in dev mode first** before production
- **Keep it simple** - start with message-processor
- **Check examples** in the builtin plugins folder
- **TypeScript works too!** Just use .ts extension

## 🔧 Troubleshooting

**Plugin not loading?**
1. Check plugin.json syntax (use JSON validator)
2. Check console for errors (F12)
3. Make sure index.js exports the class correctly
4. Restart OpenChat

**Plugin crashes?**
1. Check console for error messages
2. Add try-catch blocks in your code
3. Test with simple console.log first

## 📚 Full Documentation

For complete API reference and advanced examples:
https://github.com/OpenChatGit/OpenChat/blob/main/src/plugins/PLUGIN_GUIDE.md

## 🎯 Example Plugins

### Uppercase Plugin
\`\`\`javascript
class UppercasePlugin {
  metadata = {
    id: 'uppercase',
    name: 'Uppercase',
    version: '1.0.0',
    type: 'message-processor',
    enabled: true
  }

  processOutgoing(content) {
    return content.toUpperCase()
  }
}

module.exports = UppercasePlugin
\`\`\`

### Emoji Plugin
\`\`\`javascript
class EmojiPlugin {
  metadata = {
    id: 'emoji',
    name: 'Emoji Replacer',
    version: '1.0.0',
    type: 'message-processor',
    enabled: true
  }

  processIncoming(content) {
    return content
      .replace(':)', '😊')
      .replace(':D', '😄')
      .replace(':(', '😢')
  }
}

module.exports = EmojiPlugin
\`\`\`

Happy Plugin Development! 🚀
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
 * Load plugin code from a plugin directory
 * Supports both .js and .ts files
 */
export async function loadPluginCode(pluginName: string): Promise<string | null> {
  try {
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      const { readTextFile, exists } = await import('@tauri-apps/plugin-fs')
      const { join } = await import('@tauri-apps/api/path')
      const pluginsDir = await getPluginsDirectory()
      
      // Try index.js first, then index.ts
      const possibleFiles = ['index.js', 'index.ts', `${pluginName}.js`, `${pluginName}.ts`]
      
      for (const filename of possibleFiles) {
        const codePath = await join(pluginsDir, pluginName, filename)
        const codeExists = await exists(codePath)
        
        if (codeExists) {
          const code = await readTextFile(codePath)
          console.log(`[Plugins] Loaded code for ${pluginName} from ${filename}`)
          return code
        }
      }
      
      console.warn(`[Plugins] No code file found for ${pluginName}`)
    }
  } catch (error) {
    console.error(`Failed to load code for ${pluginName}:`, error)
  }
  
  return null
}

/**
 * Dynamically execute plugin code and return the plugin instance
 * Uses Function constructor for safe evaluation
 */
export async function executePluginCode(pluginName: string, code: string): Promise<any | null> {
  try {
    // Create a safe execution context
    const exports: any = {}
    const module = { exports }
    
    // Wrap code in a function to provide module/exports
    const wrappedCode = `
      (function(module, exports) {
        ${code}
        
        // Support both ES6 export and CommonJS
        if (typeof module.exports.default !== 'undefined') {
          return module.exports.default;
        }
        
        // Look for exported class
        const exportedKeys = Object.keys(module.exports);
        if (exportedKeys.length > 0) {
          return module.exports[exportedKeys[0]];
        }
        
        return module.exports;
      })
    `
    
    // Execute the wrapped code
    const fn = new Function('module', 'exports', `return ${wrappedCode}`)
    const PluginClass = fn(module, exports)
    
    // Instantiate the plugin
    if (typeof PluginClass === 'function') {
      const instance = new PluginClass()
      console.log(`[Plugins] Successfully instantiated ${pluginName}`)
      return instance
    } else if (typeof PluginClass === 'object') {
      console.log(`[Plugins] Using plugin object for ${pluginName}`)
      return PluginClass
    }
    
    console.error(`[Plugins] Invalid plugin export for ${pluginName}`)
    return null
  } catch (error) {
    console.error(`Failed to execute plugin code for ${pluginName}:`, error)
    return null
  }
}

/**
 * Load and instantiate an external plugin
 */
export async function loadExternalPlugin(pluginName: string): Promise<any | null> {
  try {
    // Load manifest
    const manifest = await loadPluginManifest(pluginName)
    if (!manifest) {
      console.error(`[Plugins] No manifest for ${pluginName}`)
      return null
    }
    
    // Load code
    const code = await loadPluginCode(pluginName)
    if (!code) {
      console.error(`[Plugins] No code for ${pluginName}`)
      return null
    }
    
    // Execute code and get plugin instance
    const plugin = await executePluginCode(pluginName, code)
    if (!plugin) {
      console.error(`[Plugins] Failed to instantiate ${pluginName}`)
      return null
    }
    
    // Merge manifest metadata with plugin
    if (plugin.metadata) {
      plugin.metadata = {
        ...manifest,
        ...plugin.metadata,
        isBuiltin: false,
        loaded: true
      }
    } else {
      plugin.metadata = {
        ...manifest,
        isBuiltin: false,
        loaded: true
      }
    }
    
    console.log(`[Plugins] Successfully loaded external plugin: ${pluginName}`)
    return plugin
  } catch (error) {
    console.error(`Failed to load external plugin ${pluginName}:`, error)
    return null
  }
}
