# Getting Started with OpenChat Plugins

Learn how to create your first OpenChat plugin in minutes!

## Quick Start

### 1. Open the Plugins Folder

Click the "Open Plugins Folder" button in Settings → Plugins, or navigate to:
- **Windows**: `%APPDATA%/OpenChat/plugins/`
- **macOS**: `~/Library/Application Support/OpenChat/plugins/`
- **Linux**: `~/.config/OpenChat/plugins/`

### 2. Create Your Plugin Folder

Create a new folder with your plugin name (use kebab-case):
```
plugins/
└── my-first-plugin/
```

### 3. Create plugin.json

Create a `plugin.json` file with your plugin metadata:

```json
{
  "id": "my-first-plugin",
  "name": "My First Plugin",
  "version": "1.0.0",
  "description": "My awesome plugin for OpenChat",
  "author": "Your Name"
}
```

### 4. Create index.js

Create an `index.js` file with your plugin code:

```javascript
class MyFirstPlugin {
  onLoad() {
    console.log('My plugin loaded!')
    
    // Show a notification
    pluginAPI.ui.showNotification('Hello from my plugin!', 'success')
    
    // Register a hook to modify messages
    pluginAPI.hooks.register('message.render.user', (context) => {
      // Add emoji to all user messages
      context.content = '👤 ' + context.content
      return context
    })
  }
  
  onUnload() {
    console.log('My plugin unloaded!')
  }
}

// Export your plugin class
export default MyFirstPlugin
```

### 5. Reload OpenChat

Restart OpenChat or reload the plugins from Settings → Plugins.

Your plugin should now appear in the plugin list!

## Plugin Structure

A minimal plugin consists of two files:

```
my-plugin/
├── plugin.json    # Plugin metadata
└── index.js       # Plugin code
```

### plugin.json

Required fields:
- `id`: Unique identifier (kebab-case)
- `name`: Display name
- `version`: Semantic version (e.g., "1.0.0")
- `description`: Short description
- `author`: Your name

Optional fields:
- `homepage`: Plugin website URL
- `repository`: Git repository URL
- `license`: License type (e.g., "MIT")
- `keywords`: Array of search keywords
- `permissions`: Array of required permissions
- `config`: Configuration schema (see Configuration section)

### index.js (or index.ts)

Your plugin code must export a class with lifecycle methods:

```javascript
class MyPlugin {
  // Called when plugin loads
  onLoad() {
    // Initialize your plugin
  }
  
  // Called when plugin unloads
  onUnload() {
    // Clean up resources
  }
  
  // Called when plugin is enabled
  onEnable() {
    // Optional
  }
  
  // Called when plugin is disabled
  onDisable() {
    // Optional
  }
  
  // Called when config changes
  onConfigChange(config) {
    // Optional
  }
}

export default MyPlugin
```

## Using the Plugin API

The `pluginAPI` object is globally available in your plugin code. No imports needed!

### Hooks

Hooks let you extend OpenChat functionality:

```javascript
// Modify user messages
pluginAPI.hooks.register('message.render.user', (context) => {
  context.content = context.content.toUpperCase()
  return context
})

// Modify assistant messages
pluginAPI.hooks.register('message.render.assistant', (context) => {
  context.content = '🤖 ' + context.content
  return context
})
```

### UI

Interact with the user interface:

```javascript
// Show notifications
pluginAPI.ui.showNotification('Hello!', 'info')
pluginAPI.ui.showNotification('Success!', 'success')
pluginAPI.ui.showNotification('Error!', 'error')

// Add toolbar buttons
pluginAPI.ui.addToolbarButton({
  id: 'my-button',
  label: 'Click Me',
  icon: 'star',
  onClick: () => {
    pluginAPI.ui.showNotification('Button clicked!', 'success')
  }
})
```

### Storage

Persist data for your plugin:

```javascript
// Save data
await pluginAPI.storage.set('myData', { count: 42 })

// Load data
const data = await pluginAPI.storage.get('myData', { count: 0 })
console.log('Count:', data.count)

// Delete data
await pluginAPI.storage.delete('myData')

// Clear all data
await pluginAPI.storage.clear()
```

### Configuration

Access plugin configuration:

```javascript
// Get config value
const enabled = pluginAPI.config.get('enabled', true)

// Set config value
pluginAPI.config.set('enabled', false)

// Get all config
const config = pluginAPI.config.getAll()
```

## Configuration Schema

Add a `config` field to your `plugin.json` to create a settings UI:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "A configurable plugin",
  "author": "Your Name",
  "config": {
    "type": "object",
    "properties": {
      "enabled": {
        "type": "boolean",
        "title": "Enable Feature",
        "description": "Enable or disable the main feature",
        "default": true
      },
      "prefix": {
        "type": "string",
        "title": "Message Prefix",
        "description": "Prefix to add to messages",
        "default": "👋"
      },
      "count": {
        "type": "number",
        "title": "Counter",
        "description": "Number of times to repeat",
        "default": 1,
        "minimum": 1,
        "maximum": 10
      },
      "theme": {
        "type": "string",
        "title": "Theme",
        "description": "Select a theme",
        "enum": ["light", "dark", "auto"],
        "default": "auto"
      }
    }
  }
}
```

Access config in your plugin:

```javascript
class MyPlugin {
  onLoad() {
    const prefix = pluginAPI.config.get('prefix', '👋')
    const count = pluginAPI.config.get('count', 1)
    
    pluginAPI.hooks.register('message.render.user', (context) => {
      context.content = prefix.repeat(count) + ' ' + context.content
      return context
    })
  }
  
  onConfigChange(config) {
    console.log('Config changed:', config)
    // Reload hooks with new config
  }
}
```

## TypeScript Support

You can write plugins in TypeScript! Just use `index.ts` instead of `index.js`:

```typescript
// index.ts
declare const pluginAPI: any

class MyPlugin {
  private count: number = 0
  
  onLoad(): void {
    pluginAPI.ui.showNotification('TypeScript plugin loaded!', 'success')
  }
  
  onUnload(): void {
    console.log('Unloaded')
  }
}

export default MyPlugin
```

## Testing Your Plugin

### Development Mode

1. Make changes to your plugin files
2. Click "Reload" button in Settings → Plugins
3. Test your changes immediately

### Production Build

Always test your plugin in the production build (.exe):

1. Build OpenChat: `npm run build`
2. Run the built executable
3. Verify your plugin works correctly

**Important**: External plugins work differently in production:
- No access to `src/` files
- No React imports
- Only `pluginAPI` is available
- Must use standard JavaScript/TypeScript only

## Common Patterns

### Conditional Hook Registration

```javascript
class MyPlugin {
  onLoad() {
    const enabled = pluginAPI.config.get('enabled', true)
    
    if (enabled) {
      pluginAPI.hooks.register('message.render.user', this.handleMessage)
    }
  }
  
  handleMessage(context) {
    // Your logic here
    return context
  }
}
```

### Async Operations

```javascript
class MyPlugin {
  async onLoad() {
    // Load data from storage
    const data = await pluginAPI.storage.get('data', {})
    
    // Initialize with loaded data
    this.initialize(data)
  }
  
  initialize(data) {
    console.log('Initialized with:', data)
  }
}
```

### Error Handling

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
          return context // Always return context
        }
      })
    } catch (error) {
      console.error('Failed to register hook:', error)
      pluginAPI.ui.showNotification('Plugin failed to load', 'error')
    }
  }
}
```

## Next Steps

- Read the [Plugin API Reference](PLUGIN_API.md) for complete API documentation
- Check out [Examples](EXAMPLES.md) for more plugin ideas
- See [Hooks Reference](HOOKS_REFERENCE.md) for all available hooks

## Troubleshooting

### Plugin doesn't appear in list
- Check that `plugin.json` is valid JSON
- Verify the `id` field is unique
- Restart OpenChat

### Plugin fails to load
- Check browser console for errors
- Verify your plugin class is exported correctly
- Make sure you're not using React imports or internal modules

### Hooks not working
- Verify the hook type is correct
- Check that the plugin is enabled
- Make sure you're returning the context object

### Storage not persisting
- Verify you're using `await` with storage methods
- Check browser console for errors
- Try clearing storage and starting fresh

## Need Help?

- Check the documentation in Settings → Plugins → Documentation
- Look at built-in plugins for examples
- Report issues on GitHub
