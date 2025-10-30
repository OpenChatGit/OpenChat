# Plugin API

This directory contains the Plugin API implementation for OpenChat. The Plugin API provides a unified interface for plugins to interact with the application.

## Overview

The Plugin API is injected as a global `pluginAPI` object into plugin code at runtime. This means external plugins don't need any imports or access to OpenChat source code.

## API Components

### HooksAPI (`HooksAPI.ts`)
Allows plugins to register hooks at various extension points in the application.

**Methods:**
- `register(hookType, handler, priority?)` - Register a hook handler
- `unregister(hookType)` - Unregister a specific hook
- `unregisterAll()` - Unregister all hooks (called on plugin unload)

### StorageAPI (`StorageAPI.ts`)
Provides isolated persistent storage for plugins using localStorage.

**Methods:**
- `get(key, defaultValue?)` - Get a value from storage
- `set(key, value)` - Set a value in storage
- `delete(key)` - Delete a value from storage
- `clear()` - Clear all plugin storage
- `keys()` - Get all storage keys
- `has(key)` - Check if a key exists
- `size()` - Get approximate storage size in bytes

### UIAPI (`UIAPI.ts`)
Provides UI interaction methods for plugins.

**Methods:**
- `showNotification(message, type?)` - Show a notification
- `showModal(component)` - Show a modal dialog
- `hideModal()` - Hide the current modal
- `addToolbarButton(button)` - Add a toolbar button
- `removeToolbarButton(id)` - Remove a toolbar button

### ConfigAPI (`ConfigAPI.ts`)
Manages plugin configuration with schema validation.

**Methods:**
- `get(key, defaultValue?)` - Get a config value
- `set(key, value)` - Set a config value
- `getAll()` - Get all config values
- `reset(key)` - Reset a config value to default
- `resetAll()` - Reset all config values
- `has(key)` - Check if a config key exists
- `getSchema()` - Get the config schema

## Usage Example

```typescript
// External plugin code (no imports needed!)
class MyPlugin {
  onLoad() {
    // Register a hook
    pluginAPI.hooks.register('message.render.user', (context) => {
      return <div>Custom UI under user messages</div>
    })
    
    // Show notification
    pluginAPI.ui.showNotification('MyPlugin loaded!', 'success')
    
    // Store data
    await pluginAPI.storage.set('lastLoaded', Date.now())
    
    // Get config
    const apiKey = pluginAPI.config.get('apiKey', '')
  }
  
  onUnload() {
    console.log('Plugin unloaded')
  }
}

// Export the plugin
export default MyPlugin
```

## Type Definitions

The `pluginAPI.d.ts` file provides TypeScript definitions for the global `pluginAPI` object. External plugin developers can reference this for type checking.

## Architecture

```
┌─────────────────────────────────────┐
│         Plugin Code                  │
│  (External, no imports needed)       │
└──────────────┬──────────────────────┘
               │
               │ Uses global pluginAPI
               ▼
┌─────────────────────────────────────┐
│         PluginAPI                    │
│  (Injected at runtime)               │
├─────────────────────────────────────┤
│  - hooks: HooksAPI                   │
│  - storage: StorageAPI               │
│  - ui: UIAPI                         │
│  - config: ConfigAPI                 │
│  - session: SessionAPI               │
│  - message: MessageAPI               │
│  - plugin: PluginInfo                │
└─────────────────────────────────────┘
```

## Key Features

1. **No Imports Required**: The `pluginAPI` object is injected at runtime, so external plugins don't need to import anything from OpenChat source code.

2. **Namespace Isolation**: Each plugin gets its own isolated API instance with scoped storage and hooks.

3. **Type Safety**: Full TypeScript definitions are provided for plugin developers.

4. **Error Handling**: All API methods include validation and error handling.

5. **Automatic Cleanup**: When a plugin is unloaded, all its hooks and UI elements are automatically cleaned up.

## Next Steps

The following APIs are placeholders and need to be implemented:
- `session` - Session management API
- `message` - Message handling API

These will be implemented in future tasks.
