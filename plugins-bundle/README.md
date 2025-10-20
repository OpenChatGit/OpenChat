# OpenChat Plugins

This directory contains plugins for OpenChat.

## Directory Structure

```
plugins/
  ├── external/          # User-installable plugins
  │   └── example-uppercase/
  │       ├── plugin.json
  │       ├── index.js
  │       └── README.md
  └── README.md         # This file
```

## Plugin Types

### External Plugins
Located in the `external/` folder. These can be enabled/disabled by users and serve as examples for creating custom plugins.

### Built-in Plugins
Built-in plugins are compiled into the application and cannot be removed. They provide core functionality like:
- Markdown rendering
- Message export
- Code syntax highlighting

## Creating Your Own Plugin

1. Create a new folder in the `external/` directory
2. Add a `plugin.json` manifest file
3. Add an `index.js` file with your plugin code
4. Restart OpenChat to load the plugin

### Plugin Manifest (plugin.json)

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "My custom plugin",
  "author": "Your Name",
  "type": "message-processor",
  "appVersion": ">=0.4.0",
  "enabled": false
}
```

### Plugin Code (index.js)

```javascript
export class MyPlugin {
  metadata = {
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
    description: 'My custom plugin',
    type: 'message-processor',
    enabled: false,
    isBuiltin: false
  }

  processOutgoing(content) {
    // Transform outgoing messages
    return content
  }

  onLoad() {
    console.log('Plugin loaded!')
  }
}
```

## Plugin Types

- `message-processor` - Transform messages before/after sending
- `renderer` - Custom content rendering
- `tool` - Add callable tools for AI
- `ui-extension` - Add UI components

## Documentation

For full documentation, visit:
https://github.com/OpenChatGit/OpenChat/blob/main/src/plugins/PLUGIN_GUIDE.md
