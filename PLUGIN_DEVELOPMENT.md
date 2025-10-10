# Plugin Development Guide

This guide explains how to create plugins for OpenChat with the **simplified auto-discovery system**.

## 🆕 What's New

- **Global Tooling System**: Create tool plugins that AI can call with simple syntax like `{tool_name}`
- **Multiple Tools Per Plugin**: One plugin can provide multiple tools
- **Tool Display in UI**: Tools are automatically shown in the plugin details
- **Simplified Reasoning**: Only `<think>` tags are recognized for reasoning blocks
- **Better Formatting**: Reasoning blocks now have proper paragraph spacing

## 🚀 Quick Start (3 Steps!)

### 1. Create Your Plugin Folder

Choose the right location:
- **Core plugins** (OpenChat Team): `src/plugins/core/your-plugin/`
- **External plugins** (Community): `src/plugins/external/your-plugin/`

### 2. Create Required Files

```
your-plugin/
├── plugin.json    # Plugin manifest
├── index.ts       # Plugin implementation
└── README.md      # Documentation (optional but recommended)
```

### 3. Done! 🎉

Your plugin will be **automatically discovered and loaded**. No manual registration needed!

## 📝 Example: Creating a Simple Plugin

### Step 1: Create the manifest (`plugin.json`)

```json
{
  "id": "my-awesome-plugin",
  "name": "My Awesome Plugin",
  "version": "1.0.0",
  "description": "Does something awesome",
  "author": "Your Name",
  "type": "tool",
  "appVersion": "0.1.0",
  "core": false
}
```

### Step 2: Implement the plugin (`index.ts`)

```typescript
import type { ToolPlugin, PluginMetadata } from '../../types'
import manifestData from './plugin.json'

export class MyAwesomePlugin implements ToolPlugin {
  metadata: PluginMetadata & { type: 'tool' } = {
    ...(manifestData as any),
    enabled: true,
  }

  getTool() {
    return {
      name: 'my_awesome_tool',
      description: 'Does something awesome',
      parameters: {
        input: {
          type: 'string',
          description: 'Input text',
          required: true,
        },
      },
    }
  }

  async execute(params: { input: string }) {
    return `You said: ${params.input}`
  }

  onLoad() {
    console.log(`[${this.metadata.name}] v${this.metadata.version} loaded`)
  }
}
```

### Step 3: Test it!

Restart your app and your plugin will be automatically loaded!

## 📚 Plugin Types

### 1. Tool Plugin
Adds functions/tools that the AI can use. Tool plugins can provide **multiple tools**.

#### Plugin Manifest (`plugin.json`)
```json
{
  "id": "my-tool-plugin",
  "name": "My Tool Plugin",
  "version": "1.0.0",
  "description": "Provides useful tools for AI",
  "author": "Your Name",
  "type": "tool",
  "appVersion": "1.0.0",
  "core": false,
  "tools": [
    {
      "name": "my_tool",
      "call": "{my_tool}",
      "description": "Does something useful"
    },
    {
      "name": "another_tool",
      "call": "{another_tool}",
      "description": "Does something else"
    }
  ]
}
```

#### Plugin Implementation (`index.ts`)
```typescript
import type { ToolPlugin } from '../../types'

export class MyToolPlugin implements ToolPlugin {
  metadata = {
    id: 'my-tool-plugin',
    name: 'My Tool Plugin',
    version: '1.0.0',
    description: 'Provides useful tools for AI',
    author: 'Your Name',
    type: 'tool' as const,
    appVersion: '1.0.0',
    enabled: true,
    core: false,
  }

  tools = [
    {
      type: 'function' as const,
      function: {
        name: 'my_tool',
        description: 'Does something useful',
        parameters: {
          type: 'object' as const,
          properties: {
            input: {
              type: 'string',
              description: 'Input parameter',
            },
          },
          required: ['input'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'another_tool',
        description: 'Does something else',
        parameters: {
          type: 'object' as const,
          properties: {
            value: {
              type: 'number',
              description: 'A number value',
            },
          },
          required: ['value'],
        },
      },
    },
  ]

  async executeTool(toolName: string, args: Record<string, any>): Promise<string> {
    switch (toolName) {
      case 'my_tool':
        return `Processed: ${args.input}`
      
      case 'another_tool':
        return `Result: ${args.value * 2}`
      
      default:
        throw new Error(`Unknown tool: ${toolName}`)
    }
  }

  onLoad() {
    console.log(`[${this.metadata.name}] loaded with ${this.tools.length} tools`)
  }
}
```

**AI Usage**: The AI can call these tools using simple syntax:
- `{my_tool}` - Calls the first tool
- `{another_tool}` - Calls the second tool

### 2. Renderer Plugin
Custom rendering for message content.

```typescript
import type { RendererPlugin, PluginMetadata } from '../../types'
import manifestData from './plugin.json'

export class MyRendererPlugin implements RendererPlugin {
  metadata: PluginMetadata & { type: 'renderer' } = {
    ...(manifestData as any),
    enabled: true,
  }

  canRender(content: string): boolean {
    // Return true if this plugin can render the content
    return content.startsWith('CUSTOM:')
  }

  render(content: string): React.ReactNode {
    // Return React component or JSX
    return <div className="custom">{content}</div>
  }

  onLoad() {
    console.log(`[${this.metadata.name}] loaded`)
  }
}
```

### 3. Message Processor Plugin
Transform messages before/after sending.

```typescript
import type { MessageProcessorPlugin, PluginMetadata } from '../../types'
import manifestData from './plugin.json'

export class MyProcessorPlugin implements MessageProcessorPlugin {
  metadata: PluginMetadata & { type: 'message-processor' } = {
    ...(manifestData as any),
    enabled: true,
  }

  processOutgoing(content: string): string {
    // Transform user messages before sending to AI
    return content.trim()
  }

  processIncoming(content: string): string {
    // Transform AI responses before displaying
    return content
  }

  onLoad() {
    console.log(`[${this.metadata.name}] loaded`)
  }
}
```

## 🔄 Plugin Lifecycle

Plugins have four lifecycle hooks:

```typescript
export class MyPlugin implements ToolPlugin {
  // ... metadata and other methods ...

  onLoad(context?: PluginContext) {
    // Called when plugin is registered
    // Initialize resources, set up listeners, etc.
  }

  onEnable() {
    // Called when plugin is enabled
    // Start processing, activate features
  }

  onDisable() {
    // Called when plugin is disabled
    // Stop processing, deactivate features
  }

  onUnload() {
    // Called when plugin is unregistered
    // Clean up resources, remove listeners
  }
}
```

## 🎯 Best Practices

### ✅ DO
- Keep plugins focused on one task
- Handle errors gracefully with try-catch
- Clean up resources in `onUnload()`
- Document your plugin with a README
- Use semantic versioning (1.0.0, 1.1.0, etc.)
- Test with different AI providers
- Use TypeScript for type safety

### ❌ DON'T
- Don't crash the app on errors
- Don't modify global state directly
- Don't create memory leaks
- Don't hardcode values (make them configurable)
- Don't skip the manifest file
- Don't use generic IDs (be specific)

## 📦 Plugin Manifest Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique identifier (kebab-case) |
| `name` | string | ✅ | Display name |
| `version` | string | ✅ | Semantic version (x.y.z) |
| `description` | string | ✅ | Short description |
| `author` | string | ✅ | Author name |
| `homepage` | string | ❌ | Plugin website |
| `repository` | string | ❌ | Source code repository |
| `license` | string | ❌ | License type (e.g., MIT) |
| `type` | string | ✅ | Plugin type (see below) |
| `appVersion` | string | ✅ | Minimum OpenChat version |
| `dependencies` | array | ❌ | Other plugin IDs required |
| `core` | boolean | ❌ | If true, cannot be disabled |
| `tools` | array | ❌ | Tool definitions (for tool plugins only) |

### Tools Field (for Tool Plugins)

Each tool in the `tools` array should have:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Tool function name (snake_case) |
| `call` | string | ✅ | Call syntax shown in UI (e.g., `{tool_name}`) |
| `description` | string | ✅ | What the tool does |

**Example:**
```json
"tools": [
  {
    "name": "create_memory",
    "call": "{create_memory}",
    "description": "Store information for future conversations"
  }
]
```

### Plugin Types
- `message-processor` - Transform messages
- `renderer` - Custom rendering
- `tool` - Add functions/tools
- `storage` - Custom storage
- `ui-extension` - Add UI components

## 🔍 How Auto-Discovery Works

The plugin system automatically:
1. Scans `src/plugins/core/` and `src/plugins/external/`
2. Finds all `index.ts` or `index.tsx` files
3. Imports and instantiates plugin classes
4. Registers them with the PluginManager
5. Calls lifecycle hooks (`onLoad`, `onEnable`)

**No manual registration needed!** Just create your plugin folder and files.

## 🐛 Debugging

Enable plugin debug logs:

```typescript
// In your plugin
onLoad() {
  console.log(`[${this.metadata.name}] Plugin loaded`)
  console.log('Configuration:', this.metadata)
}
```

Check the browser console for:
- `[Plugin Loader] Discovered: ...` - Plugin was found
- `[Plugin System] Registering ...` - Plugin is being registered
- `[YourPlugin] loaded` - Your plugin's onLoad was called

## 📖 Examples

Check out these plugins for reference:

- **Markdown Renderer** (`core/markdown-renderer/`) - Renderer plugin
- **Web Search** (`core/web-search/`) - Tool plugin with RAG
- **Message Export** (`external/message-export/`) - Tool plugin
- **Plugin Template** (`PLUGIN_TEMPLATE/`) - Copy this to start

## 🤝 Contributing

1. Fork the repository
2. Create your plugin in `src/plugins/external/`
3. Test thoroughly
4. Create a Pull Request
5. Include documentation and examples

## 📞 Need Help?

- Check existing plugins for examples
- Read the type definitions in `src/plugins/types.ts`
- Review the PluginManager in `src/plugins/PluginManager.ts`
- Open an issue on GitHub

---

**Happy Plugin Development! 🚀**
