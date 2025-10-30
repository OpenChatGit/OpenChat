# Plugin API Reference

Complete reference for the OpenChat Plugin API.

## Overview

The Plugin API provides a global `pluginAPI` object that is automatically injected into your plugin at runtime. You don't need any imports - just use `pluginAPI` directly in your code.

**Important**: External plugins have NO access to:
- React imports
- OpenChat internal modules
- Node modules
- `src/` files

They ONLY have access to:
- The global `pluginAPI` object (injected at runtime)
- Standard JavaScript/TypeScript
- Their own plugin files

## Global API Object

```typescript
// Available globally in all plugins
pluginAPI: {
  hooks: HooksAPI
  ui: UIAPI
  storage: StorageAPI
  config: ConfigAPI
  plugin: PluginInfo
}
```

## Hooks API

Register hooks to extend OpenChat functionality.

### `pluginAPI.hooks.register(hookType, handler, priority?)`

Register a hook handler.

**Parameters:**
- `hookType` (string): The type of hook to register
- `handler` (function): The function to call when the hook is triggered
- `priority` (number, optional): Execution priority (lower = earlier, default: 100)

**Example:**
```javascript
pluginAPI.hooks.register('message.render.user', (context) => {
  // Modify user message rendering
  context.content = context.content + ' [Modified]'
  return context
}, 50)
```

### `pluginAPI.hooks.unregister(hookType)`

Unregister a hook handler.

**Parameters:**
- `hookType` (string): The type of hook to unregister

**Example:**
```javascript
pluginAPI.hooks.unregister('message.render.user')
```

## UI API

Interact with the OpenChat user interface.

### `pluginAPI.ui.showNotification(message, type?)`

Display a notification to the user.

**Parameters:**
- `message` (string): The notification message
- `type` (string, optional): Notification type - 'info', 'success', 'error', 'warning' (default: 'info')

**Example:**
```javascript
pluginAPI.ui.showNotification('Plugin loaded successfully!', 'success')
pluginAPI.ui.showNotification('An error occurred', 'error')
```

### `pluginAPI.ui.showModal(component)`

Show a modal dialog (React component).

**Parameters:**
- `component` (React.ComponentType): The React component to display

**Example:**
```javascript
pluginAPI.ui.showModal(MyModalComponent)
```

### `pluginAPI.ui.hideModal()`

Hide the currently displayed modal.

**Example:**
```javascript
pluginAPI.ui.hideModal()
```

### `pluginAPI.ui.addToolbarButton(button)`

Add a button to the toolbar.

**Parameters:**
- `button` (object): Button configuration
  - `id` (string): Unique button identifier
  - `label` (string): Button label
  - `icon` (string): Icon name
  - `onClick` (function): Click handler

**Example:**
```javascript
pluginAPI.ui.addToolbarButton({
  id: 'my-button',
  label: 'My Action',
  icon: 'star',
  onClick: () => {
    console.log('Button clicked!')
  }
})
```

### `pluginAPI.ui.removeToolbarButton(id)`

Remove a toolbar button.

**Parameters:**
- `id` (string): Button identifier

**Example:**
```javascript
pluginAPI.ui.removeToolbarButton('my-button')
```

## Storage API

Persist data for your plugin. Each plugin has its own isolated storage namespace.

### `pluginAPI.storage.get(key, defaultValue?)`

Get a value from storage.

**Parameters:**
- `key` (string): Storage key
- `defaultValue` (any, optional): Default value if key doesn't exist

**Returns:** Promise<any>

**Example:**
```javascript
const count = await pluginAPI.storage.get('clickCount', 0)
console.log('Click count:', count)
```

### `pluginAPI.storage.set(key, value)`

Set a value in storage.

**Parameters:**
- `key` (string): Storage key
- `value` (any): Value to store (must be JSON-serializable)

**Returns:** Promise<void>

**Example:**
```javascript
await pluginAPI.storage.set('clickCount', count + 1)
await pluginAPI.storage.set('settings', { theme: 'dark', fontSize: 14 })
```

### `pluginAPI.storage.delete(key)`

Delete a value from storage.

**Parameters:**
- `key` (string): Storage key

**Returns:** Promise<void>

**Example:**
```javascript
await pluginAPI.storage.delete('clickCount')
```

### `pluginAPI.storage.clear()`

Clear all storage for this plugin.

**Returns:** Promise<void>

**Example:**
```javascript
await pluginAPI.storage.clear()
```

## Config API

Access and modify plugin configuration.

### `pluginAPI.config.get(key, defaultValue?)`

Get a configuration value.

**Parameters:**
- `key` (string): Config key
- `defaultValue` (any, optional): Default value if key doesn't exist

**Returns:** any

**Example:**
```javascript
const enabled = pluginAPI.config.get('enabled', true)
const theme = pluginAPI.config.get('theme', 'dark')
```

### `pluginAPI.config.set(key, value)`

Set a configuration value.

**Parameters:**
- `key` (string): Config key
- `value` (any): Value to set

**Example:**
```javascript
pluginAPI.config.set('enabled', false)
pluginAPI.config.set('theme', 'light')
```

### `pluginAPI.config.getAll()`

Get all configuration values.

**Returns:** object

**Example:**
```javascript
const config = pluginAPI.config.getAll()
console.log('Current config:', config)
```

## Plugin Info

Access information about your plugin.

### `pluginAPI.plugin`

Read-only information about the current plugin.

**Properties:**
- `id` (string): Plugin unique identifier
- `name` (string): Plugin display name
- `version` (string): Plugin version
- `enabled` (boolean): Whether plugin is currently enabled

**Example:**
```javascript
console.log('Plugin ID:', pluginAPI.plugin.id)
console.log('Plugin Name:', pluginAPI.plugin.name)
console.log('Version:', pluginAPI.plugin.version)
console.log('Enabled:', pluginAPI.plugin.enabled)
```

## Plugin Lifecycle

Your plugin class can implement these lifecycle methods:

### `onLoad()`

Called when the plugin is loaded.

**Example:**
```javascript
class MyPlugin {
  onLoad() {
    console.log('Plugin loaded!')
    pluginAPI.hooks.register('message.render.user', this.handleMessage)
  }
  
  handleMessage(context) {
    return context
  }
}
```

### `onUnload()`

Called when the plugin is unloaded.

**Example:**
```javascript
class MyPlugin {
  onUnload() {
    console.log('Plugin unloaded!')
    pluginAPI.hooks.unregister('message.render.user')
  }
}
```

### `onEnable()`

Called when the plugin is enabled.

**Example:**
```javascript
class MyPlugin {
  onEnable() {
    console.log('Plugin enabled!')
  }
}
```

### `onDisable()`

Called when the plugin is disabled.

**Example:**
```javascript
class MyPlugin {
  onDisable() {
    console.log('Plugin disabled!')
  }
}
```

### `onConfigChange(config)`

Called when plugin configuration changes.

**Parameters:**
- `config` (object): New configuration object

**Example:**
```javascript
class MyPlugin {
  onConfigChange(config) {
    console.log('Config changed:', config)
    // React to configuration changes
  }
}
```

## TypeScript Support

For TypeScript plugins, you can use type definitions:

```typescript
declare const pluginAPI: {
  hooks: {
    register(hookType: string, handler: Function, priority?: number): void
    unregister(hookType: string): void
  }
  ui: {
    showNotification(message: string, type?: 'info' | 'success' | 'error' | 'warning'): void
    showModal(component: any): void
    hideModal(): void
    addToolbarButton(button: any): void
    removeToolbarButton(id: string): void
  }
  storage: {
    get<T>(key: string, defaultValue?: T): Promise<T>
    set<T>(key: string, value: T): Promise<void>
    delete(key: string): Promise<void>
    clear(): Promise<void>
  }
  config: {
    get<T>(key: string, defaultValue?: T): T
    set<T>(key: string, value: T): void
    getAll(): Record<string, any>
  }
  plugin: {
    id: string
    name: string
    version: string
    enabled: boolean
  }
}

class MyPlugin {
  onLoad?(): void | Promise<void>
  onUnload?(): void | Promise<void>
  onEnable?(): void | Promise<void>
  onDisable?(): void | Promise<void>
  onConfigChange?(config: any): void | Promise<void>
}

export default MyPlugin
```

## Error Handling

Always wrap your plugin code in try-catch blocks to prevent crashes:

```javascript
class MyPlugin {
  onLoad() {
    try {
      pluginAPI.hooks.register('message.render.user', (context) => {
        try {
          // Your code here
          return context
        } catch (error) {
          console.error('Hook error:', error)
          return context // Return original context on error
        }
      })
    } catch (error) {
      console.error('Failed to register hook:', error)
    }
  }
}
```

## Best Practices

1. **Always return context in hooks**: If you modify context, always return it
2. **Handle errors gracefully**: Use try-catch to prevent plugin crashes
3. **Clean up on unload**: Unregister hooks and clean up resources in `onUnload()`
4. **Use namespaced storage keys**: Prefix your storage keys to avoid conflicts
5. **Test in production build**: Always test your plugin in the built .exe
6. **Keep it simple**: Avoid complex dependencies and external libraries
7. **Document your plugin**: Add clear comments and a README
