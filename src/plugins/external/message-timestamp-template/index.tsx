/**
 * Message Timestamp Plugin Template
 * 
 * This is a TEMPLATE plugin that displays timestamps under user messages.
 * Use this as a starting point for creating your own UI extension plugins!
 * 
 * Features:
 * - Displays formatted timestamp under user messages
 * - Automatically enabled/disabled via plugin system
 * - Clean, minimal design
 * 
 * To create your own UI extension plugin:
 * 1. Copy this folder and rename it
 * 2. Update plugin.json with your plugin details
 * 3. Create your component in components/
 * 4. Update location and component below
 * 5. Test and enjoy!
 */

import type { UIExtensionPlugin, PluginMetadata } from '../../types'
import manifestData from './plugin.json'
import { TimestampDisplay } from './components/TimestampDisplay'

export class MessageTimestampPlugin implements UIExtensionPlugin {
  metadata: PluginMetadata & { type: 'ui-extension' } = {
    ...(manifestData as any),
    enabled: true, // Enable to show timestamps under user messages
  }

  // Where to render: under user messages
  location: 'user-message-footer' | 'ai-message-footer' | 'sidebar' | 'toolbar' | 'message-actions' | 'settings' = 'user-message-footer'

  // The component to render
  component = TimestampDisplay

  // Lifecycle hooks
  onLoad() {
    console.log(`[${this.metadata.name}] v${this.metadata.version} loaded`)
    console.log('Timestamps will be displayed under user messages')
  }

  onUnload() {
    console.log(`[${this.metadata.name}] unloaded`)
  }

  onEnable() {
    console.log(`[${this.metadata.name}] enabled - timestamps will be shown`)
  }

  onDisable() {
    console.log(`[${this.metadata.name}] disabled - timestamps will be hidden`)
  }
}
