# Creating OpenChat Plugins

This guide explains how to create plugins for OpenChat following the official plugin structure.

## Plugin Structure

Every plugin **MUST** have its own folder with the following structure:

```
your-plugin-name/
├── plugin.json       # Plugin manifest (REQUIRED)
├── index.ts          # Plugin implementation (REQUIRED)
└── README.md         # Plugin documentation (RECOMMENDED)
```

## 1. Plugin Manifest (plugin.json)

Every plugin must have a `plugin.json` file with the following fields:

```json
{
  "id": "unique-plugin-id",
  "name": "Human Readable Plugin Name",
  "version": "1.0.0",
  "description": "What does this plugin do?",
  "author": "Your Name or Organization",
  "homepage": "https://github.com/yourname/plugin-repo",
  "repository": "https://github.com/yourname/plugin-repo",
  "license": "MIT",
  "type": "message-processor",
  "appVersion": "0.1.0",
  "dependencies": [],
  "core": false
}
```

### Manifest Fields

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

### Plugin Types

- `message-processor` - Transform messages before/after sending
- `renderer` - Custom rendering for message content
- `tool` - Add functions/tools to the chat
- `storage` - Custom storage backends
- `ui-extension` - Add custom UI components

## 2. Plugin Implementation (index.ts)

### Template

```typescript
import type { MessageProcessorPlugin, PluginMetadata } from '../types'
import manifestData from './plugin.json'

export class YourPlugin implements MessageProcessorPlugin {
  metadata: PluginMetadata & { type: 'message-processor' } = {
    ...(manifestData as any),
    enabled: true,
  }

  // Your plugin logic here

  onLoad() {
    console.log(`[${this.metadata.name}] v${this.metadata.version} loaded`)
  }
}
```

### Important Notes

1. **Always import manifest**: `import manifestData from './plugin.json'`
2. **Type the metadata correctly**: Use `PluginMetadata & { type: 'your-type' }`
3. **Cast manifest data**: Use `...(manifestData as any)` to avoid TypeScript issues
4. **Export the class**: Must be a named export

## 3. Plugin Types Examples

### Message Processor Plugin

```typescript
import type { MessageProcessorPlugin, PluginMetadata } from '../types'
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

### Renderer Plugin

```typescript
import type { RendererPlugin, PluginMetadata } from '../types'
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

### Tool Plugin

```typescript
import type { ToolPlugin, PluginMetadata } from '../types'
import manifestData from './plugin.json'

export class MyToolPlugin implements ToolPlugin {
  metadata: PluginMetadata & { type: 'tool' } = {
    ...(manifestData as any),
    enabled: true,
  }

  getTool() {
    return {
      name: 'my_tool',
      description: 'What this tool does',
      parameters: {
        input: {
          type: 'string',
          description: 'Input parameter',
        },
      },
    }
  }

  async execute(params: Record<string, any>) {
    // Tool implementation
    return `Result: ${params.input}`
  }

  onLoad() {
    console.log(`[${this.metadata.name}] loaded`)
  }
}
```

## 4. Plugin Location

### Core Plugins
Location: `src/plugins/core/your-plugin/`
- Cannot be disabled by users
- Essential for app functionality
- Set `"core": true` in plugin.json

### Optional Plugins
Location: `src/plugins/optional/your-plugin/`
- Can be enabled/disabled by users
- Add extra functionality
- Set `"core": false` in plugin.json

## 5. Registering Your Plugin

Add your plugin to `src/hooks/usePlugins.ts`:

```typescript
import { YourPlugin } from '../plugins/optional/your-plugin'

// In the useEffect:
await pluginManager.register(new YourPlugin())
```

## 6. Plugin Lifecycle

Plugins have four lifecycle hooks:

```typescript
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
```

## 7. Best Practices

### ✅ DO

- Keep plugins focused on one task
- Handle errors gracefully
- Clean up resources in `onUnload()`
- Document your plugin in README.md
- Use semantic versioning
- Test with different providers
- Follow TypeScript best practices

### ❌ DON'T

- Don't crash the app on errors
- Don't modify global state directly
- Don't create memory leaks
- Don't hardcode values (make them configurable)
- Don't skip the manifest file
- Don't use generic IDs (be specific)

## 8. Testing Your Plugin

1. Create your plugin folder
2. Implement plugin.json and index.ts
3. Register in usePlugins.ts
4. Restart the app
5. Check console for load messages
6. Test functionality
7. Check Settings > Plugins to see your plugin

## 9. Publishing Your Plugin

1. Create a GitHub repository
2. Include complete documentation
3. Add usage examples
4. Specify dependencies
5. Include screenshots/demos
6. Tag releases with version numbers

## 10. Example Plugins

See these folders for examples:
- `src/plugins/core/markdown-renderer/` - Renderer plugin
- `src/plugins/optional/message-export/` - Tool plugin
- `src/plugins/PLUGIN_TEMPLATE/` - Template to copy

## Need Help?

- Check existing plugins for examples
- Read the type definitions in `src/plugins/types.ts`
- Review the PluginManager in `src/plugins/PluginManager.ts`
- Open an issue on GitHub
