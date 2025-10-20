/**
 * Example Uppercase Plugin
 * 
 * This plugin demonstrates how to create a message processor
 * that transforms outgoing messages.
 */

export class UppercasePlugin {
  metadata = {
    id: 'example-uppercase',
    name: 'Uppercase Example',
    version: '1.0.0',
    description: 'Converts messages to uppercase',
    type: 'message-processor',
    enabled: false,
    isBuiltin: false
  }

  /**
   * Transform outgoing messages to uppercase
   * @param {string} content - The message content
   * @returns {string} - The transformed content
   */
  processOutgoing(content) {
    return content.toUpperCase()
  }

  /**
   * Called when the plugin is loaded
   */
  onLoad() {
    console.log('[UppercasePlugin] Plugin loaded!')
  }

  /**
   * Called when the plugin is unloaded
   */
  onUnload() {
    console.log('[UppercasePlugin] Plugin unloaded!')
  }
}
