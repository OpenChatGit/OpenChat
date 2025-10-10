# External Plugins

This directory contains **external and community plugins** for OpenChat.

## 🌍 What are External Plugins?

External Plugins are:
- Developed by the community or third-party developers
- Optional and can be enabled/disabled
- Extend OpenChat with additional features
- Easy to add and remove

## 📦 Available Plugins

### Message Export
**Path**: `message-export/`  
**Type**: Tool  
**Description**: Export chat sessions to JSON, Markdown or Plain Text

### Examples
**Path**: `examples/`  
**Description**: Example plugins for learning and reference

## ➕ Adding a New Plugin

### 1. Create Plugin Folder
```
external/
└── your-plugin/
    ├── plugin.json
    ├── index.ts
    └── README.md
```

### 2. Create plugin.json
```json
{
  "id": "your-plugin-id",
  "name": "Your Plugin Name",
  "version": "1.0.0",
  "description": "What does it do?",
  "author": "Your Name",
  "type": "tool",
  "appVersion": "0.1.0",
  "core": false
}
```

### 3. Create index.ts
```typescript
import type { ToolPlugin, PluginMetadata } from '../../types'
import manifestData from './plugin.json'

export class YourPlugin implements ToolPlugin {
  metadata: PluginMetadata & { type: 'tool' } = {
    ...(manifestData as any),
    enabled: true,
  }

  getTool() {
    return {
      name: 'your_tool',
      description: 'What it does',
      parameters: {},
    }
  }

  async execute(params: Record<string, any>) {
    return 'Result'
  }

  onLoad() {
    console.log(`[${this.metadata.name}] loaded`)
  }
}
```

### 4. That's It!

Your plugin will be **automatically discovered and loaded**. No manual registration needed!

## 📚 Resources

- **[Plugin Template](./message-timestamp-template/)** - Working template with timestamp functionality
- [Plugin Types Reference](../types.ts)
- [Core Plugins Examples](../core/)

## 🤝 Community Guidelines

When sharing a plugin:
1. Document it well
2. Test thoroughly
3. Add examples
4. Create a Pull Request
5. Keep it updated

## ⚠️ Important

- Set `"core": false` in plugin.json
- Handle errors gracefully
- Clean up resources
- Avoid breaking changes
- Follow best practices
