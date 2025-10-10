// Example Plugin: Adds timestamps to messages
// This demonstrates how easy it is to create custom plugins

import type { MessageProcessorPlugin } from '../types'

export class TimestampPlugin implements MessageProcessorPlugin {
  metadata = {
    id: 'timestamp-plugin',
    name: 'Message Timestamps',
    version: '1.0.0',
    description: 'Automatically adds timestamps to outgoing messages',
    author: 'Example',
    type: 'message-processor' as const,
    appVersion: '1.0.0',
    enabled: false, // Disabled by default
  }

  processOutgoing(content: string): string {
    const timestamp = new Date().toLocaleTimeString()
    return `[${timestamp}] ${content}`
  }

  onLoad() {
    console.log('Timestamp plugin loaded')
  }

  onEnable() {
    console.log('Timestamp plugin enabled - messages will now include timestamps')
  }

  onDisable() {
    console.log('Timestamp plugin disabled')
  }
}
