/**
 * Example usage of PluginExecutor
 * 
 * This file demonstrates how the PluginExecutor works with different
 * plugin export patterns.
 */

import { pluginExecutor } from './PluginExecutor'
import type { PluginManifest } from './types'

// ============================================================================
// Example 1: Class Export
// ============================================================================

const exampleManifest1: PluginManifest = {
  id: 'example-plugin',
  name: 'Example Plugin',
  version: '1.0.0',
  description: 'An example plugin',
  author: 'OpenChat',
  type: 'ui-extension',
  appVersion: '>=0.5.0'
}

const exampleCode1 = `
class ExamplePlugin {
  onLoad() {
    console.log('Plugin loaded!')
    
    // pluginAPI is globally available - no imports needed!
    pluginAPI.hooks.register('message.render.user', (context) => {
      return '<div>Custom UI</div>'
    })
    
    pluginAPI.ui.showNotification('Plugin is active!', 'success')
  }
  
  onUnload() {
    console.log('Plugin unloaded!')
  }
}

// Export the class
module.exports = ExamplePlugin
`

// ============================================================================
// Example 2: Object Export
// ============================================================================

const exampleManifest2: PluginManifest = {
  id: 'simple-plugin',
  name: 'Simple Plugin',
  version: '1.0.0',
  description: 'A simple plugin',
  author: 'OpenChat',
  type: 'message-processor',
  appVersion: '>=0.5.0'
}

const exampleCode2 = `
// Direct object export
module.exports = {
  onLoad() {
    console.log('Simple plugin loaded!')
    
    // Access pluginAPI directly
    pluginAPI.storage.set('lastLoaded', new Date().toISOString())
  },
  
  processOutgoing(message, context) {
    // Transform outgoing messages
    return message + ' [Processed]'
  }
}
`

// ============================================================================
// Example 3: ES6 Default Export
// ============================================================================

const exampleManifest3: PluginManifest = {
  id: 'modern-plugin',
  name: 'Modern Plugin',
  version: '1.0.0',
  description: 'A modern ES6 plugin',
  author: 'OpenChat',
  type: 'renderer',
  appVersion: '>=0.5.0'
}

const exampleCode3 = `
class ModernPlugin {
  canRender(content) {
    return content.startsWith('custom:')
  }
  
  render(content) {
    const data = content.replace('custom:', '')
    return '<div class="custom">' + data + '</div>'
  }
  
  onLoad() {
    pluginAPI.ui.showNotification('Modern plugin ready!', 'info')
  }
}

// ES6 export
export default ModernPlugin
`

// ============================================================================
// Usage Examples
// ============================================================================

// @ts-ignore - Example function for documentation purposes
async function runExamples() {
  try {
    // Example 1: Class export
    console.log('=== Example 1: Class Export ===')
    const plugin1 = await pluginExecutor.execute(exampleCode1, exampleManifest1)
    console.log('Plugin 1 loaded:', plugin1.metadata.name)
    
    // Example 2: Object export
    console.log('\n=== Example 2: Object Export ===')
    const plugin2 = await pluginExecutor.execute(exampleCode2, exampleManifest2)
    console.log('Plugin 2 loaded:', plugin2.metadata.name)
    
    // Example 3: ES6 default export
    console.log('\n=== Example 3: ES6 Default Export ===')
    const plugin3 = await pluginExecutor.execute(exampleCode3, exampleManifest3)
    console.log('Plugin 3 loaded:', plugin3.metadata.name)
    
    console.log('\n✅ All examples executed successfully!')
    
  } catch (error) {
    console.error('❌ Error executing examples:', error)
  }
}

// Uncomment to run examples:
// runExamples()

