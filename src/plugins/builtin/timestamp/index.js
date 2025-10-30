/**
 * Timestamp Plugin
 * 
 * Adds a timestamp under user messages showing when they were posted.
 * Uses the new Plugin API System - no imports needed!
 */

class TimestampPlugin {
  /**
   * Called when plugin is loaded
   * Register our hook to render UI under user messages
   */
  onLoad() {
    console.log('[TimestampPlugin] Loading...')
    
    // Register hook to render timestamp under user messages
    // pluginAPI is globally available - no imports needed!
    pluginAPI.hooks.register(
      'message.render.user',
      (context) => {
        const message = context.message
        if (!message?.timestamp) return null

        // Return object with type and content to render
        return {
          type: 'timestamp',
          content: new Date(message.timestamp).toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        }
      },
      100 // Priority
    )

    console.log('[TimestampPlugin] Registered message.render.user hook')
  }

  /**
   * Called when plugin is unloaded
   * Cleanup: unregister all hooks
   */
  onUnload() {
    console.log('[TimestampPlugin] Unloading...')
    // Hooks are automatically unregistered by the plugin system
  }
}

// Export the plugin class
// The plugin system will instantiate it automatically
export default TimestampPlugin
