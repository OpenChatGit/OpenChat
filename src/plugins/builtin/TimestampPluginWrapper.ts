/**
 * Timestamp Plugin Wrapper
 * 
 * This wrapper loads the timestamp plugin from its directory structure
 * and provides it as a proper BasePlugin instance.
 */

import type { BasePlugin } from '../core/types'
import { PluginExecutor } from '../core/PluginExecutor'
import type { PluginManifest } from '../core/types'

// Import the manifest
import manifest from './timestamp/plugin.json'

// Import the plugin code as raw text
// Note: In production, this would be loaded from the file system
const pluginCode = `
class TimestampPlugin {
  onLoad() {
    console.log('[TimestampPlugin] Loading...')
    
    // Register hook to render timestamp under user messages
    pluginAPI.hooks.register(
      'message.render.user',
      (context) => {
        const message = context.message
        if (!message?.timestamp) return null

        // Get config values
        const format = pluginAPI.config.get('format', '12h')
        const showDate = pluginAPI.config.get('showDate', true)
        const fontSize = pluginAPI.config.get('fontSize', 12)
        const customPrefix = pluginAPI.config.get('customPrefix', 'Sent at')

        // Format timestamp based on config
        const date = new Date(message.timestamp)
        let timeString = ''

        if (format === 'relative') {
          // Relative time (e.g., "2 minutes ago")
          const now = new Date()
          const diff = now.getTime() - date.getTime()
          const seconds = Math.floor(diff / 1000)
          const minutes = Math.floor(seconds / 60)
          const hours = Math.floor(minutes / 60)
          const days = Math.floor(hours / 24)

          if (days > 0) {
            timeString = days === 1 ? '1 day ago' : \`\${days} days ago\`
          } else if (hours > 0) {
            timeString = hours === 1 ? '1 hour ago' : \`\${hours} hours ago\`
          } else if (minutes > 0) {
            timeString = minutes === 1 ? '1 minute ago' : \`\${minutes} minutes ago\`
          } else {
            timeString = 'just now'
          }
        } else {
          // Absolute time
          const options = {
            hour: '2-digit',
            minute: '2-digit',
            hour12: format === '12h'
          }

          if (showDate) {
            options.day = '2-digit'
            options.month = '2-digit'
            options.year = 'numeric'
          }

          timeString = date.toLocaleString('de-DE', options)
        }

        // Return object with type and content to render
        return {
          type: 'text',
          content: \`\${customPrefix} \${timeString}\`,
          className: \`text-xs text-gray-500 mt-1 mr-2\`,
          style: { fontSize: \`\${fontSize}px\` }
        }
      },
      100 // Priority
    )

    console.log('[TimestampPlugin] Registered message.render.user hook')
  }

  onUnload() {
    console.log('[TimestampPlugin] Unloading...')
  }
}

// Use CommonJS export instead of ES6 export
// This is required for the PluginExecutor to work correctly
module.exports = TimestampPlugin
`

/**
 * Create and return the timestamp plugin instance
 */
export async function createTimestampPlugin(): Promise<BasePlugin> {
  const executor = new PluginExecutor()
  const instance = await executor.execute(pluginCode, manifest as PluginManifest)
  
  // Update metadata
  instance.metadata.folderPath = 'src/plugins/builtin/timestamp'
  instance.metadata.isBuiltin = true
  
  return instance
}
