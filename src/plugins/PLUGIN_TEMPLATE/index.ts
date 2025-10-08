// Plugin Template - Copy this to create a new plugin

import type { MessageProcessorPlugin, PluginMetadata } from '../types'
import manifestData from './plugin.json'

export class MyPlugin implements MessageProcessorPlugin {
  metadata: PluginMetadata & { type: 'message-processor' } = {
    ...(manifestData as any),
    enabled: true,
  }

  // Transform outgoing messages (user -> AI)
  processOutgoing(content: string): string {
    // Your logic here
    return content
  }

  // Transform incoming messages (AI -> user)
  processIncoming(content: string): string {
    // Your logic here
    return content
  }

  // Called when plugin is loaded
  onLoad() {
    console.log(`[${this.metadata.name}] v${this.metadata.version} loaded`)
  }

  // Called when plugin is enabled
  onEnable() {
    console.log(`[${this.metadata.name}] enabled`)
  }

  // Called when plugin is disabled
  onDisable() {
    console.log(`[${this.metadata.name}] disabled`)
  }

  // Called when plugin is unloaded
  onUnload() {
    console.log(`[${this.metadata.name}] unloaded`)
  }
}
