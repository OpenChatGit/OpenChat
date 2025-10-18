# OpenChat Plugin Development Guide

## Overview

OpenChat supports a modular plugin system that allows you to extend functionality without modifying core code. Plugins can process messages, render content, provide tools, implement storage, or add UI extensions.

## Plugin Types

### 1. Message Processor
Transform messages before or after they are sent to a provider.

```typescript
import type { MessageProcessorPlugin } from './types'

export class MyProcessorPlugin implements MessageProcessorPlugin {
  metadata = {
    id: 'my-processor',
    name: 'My Processor',
    version: '1.0.0',
    description: 'Processes messages',
    type: 'message-processor' as const,
    enabled: true,
  }

  processOutgoing(content: string): string {
    // Transform outgoing messages
    return content.toUpperCase()
  }

  processIncoming(content: string): string {
    // Transform incoming messages
    return content
  }

  onLoad() {
    console.log('Plugin loaded')
  }

  onUnload() {
    console.log('Plugin unloaded')
  }
}
```

### 2. Renderer Plugin
Customize how content is displayed in the chat.

```typescript
import type { RendererPlugin } from './types'

export class MyRendererPlugin implements RendererPlugin {
  metadata = {
    id: 'my-renderer',
    name: 'My Renderer',
    version: '1.0.0',
    description: 'Custom content renderer',
    type: 'renderer' as const,
    enabled: true,
  }

  render(content: string): JSX.Element {
    return <div className="custom-render">{content}</div>
  }

  canHandle(content: string): boolean {
    return content.startsWith('CUSTOM:')
  }

  onLoad() {}
  onUnload() {}
}
```

### 3. Tool Plugin
Provide callable utilities that AI models can invoke.

```typescript
import type { ToolPlugin } from './types'

export class MyToolPlugin implements ToolPlugin {
  metadata = {
    id: 'my-tool',
    name: 'My Tool',
    version: '1.0.0',
    description: 'Does something useful',
    type: 'tool' as const,
    enabled: true,
  }

  getToolDefinition() {
    return {
      type: 'function' as const,
      function: {
        name: 'my_tool',
        description: 'Performs a specific task',
        parameters: {
          type: 'object',
          properties: {
            input: {
              type: 'string',
              description: 'Input parameter',
            },
          },
          required: ['input'],
        },
      },
    }
  }

  async execute(params: any): Promise<string> {
    const { input } = params
    // Perform tool logic
    return `Processed: ${input}`
  }

  onLoad() {}
  onUnload() {}
}
```

### 4. Storage Plugin
Implement alternative persistence layers.

```typescript
import type { StoragePlugin } from './types'

export class MyStoragePlugin implements StoragePlugin {
  metadata = {
    id: 'my-storage',
    name: 'My Storage',
    version: '1.0.0',
    description: 'Custom storage backend',
    type: 'storage' as const,
    enabled: true,
  }

  async save(key: string, data: any): Promise<void> {
    // Save data
  }

  async load(key: string): Promise<any> {
    // Load data
    return null
  }

  async delete(key: string): Promise<void> {
    // Delete data
  }

  onLoad() {}
  onUnload() {}
}
```

### 5. UI Extension Plugin
Add custom UI components to the interface.

```typescript
import type { UIExtensionPlugin } from './types'

export class MyUIPlugin implements UIExtensionPlugin {
  metadata = {
    id: 'my-ui',
    name: 'My UI Extension',
    version: '1.0.0',
    description: 'Adds custom UI',
    type: 'ui-extension' as const,
    enabled: true,
  }

  renderExtension(): JSX.Element {
    return (
      <div className="my-extension">
        <h3>Custom UI</h3>
        <button>Click me</button>
      </div>
    )
  }

  getPosition(): 'sidebar' | 'toolbar' | 'footer' {
    return 'sidebar'
  }

  onLoad() {}
  onUnload() {}
}
```

## Plugin Structure

### Required Metadata

Every plugin must have a `metadata` object:

```typescript
metadata = {
  id: 'unique-plugin-id',           // Unique identifier
  name: 'Human Readable Name',      // Display name
  version: '1.0.0',                 // Semantic version
  description: 'What it does',      // Short description
  type: 'plugin-type',              // One of the 5 types
  enabled: true,                    // Initial enabled state
}
```

### Lifecycle Methods

All plugins must implement:

- `onLoad()` - Called when plugin is loaded
- `onUnload()` - Called when plugin is unloaded (cleanup)

## Built-in Plugins

### Markdown Renderer
Renders markdown with syntax highlighting and math support.

**Location**: `src/plugins/builtin/markdown-renderer/`
**Type**: Renderer
**Features**: GFM, code highlighting, KaTeX math, tables

## Creating a Custom Plugin

### 1. Create Plugin File

```bash
src/plugins/custom/my-plugin/
├── index.ts          # Plugin implementation
├── types.ts          # Type definitions (optional)
└── utils.ts          # Helper functions (optional)
```

### 2. Implement Plugin Interface

```typescript
// src/plugins/custom/my-plugin/index.ts
import type { ToolPlugin } from '../../types'

export class MyCustomPlugin implements ToolPlugin {
  metadata = {
    id: 'my-custom-plugin',
    name: 'My Custom Plugin',
    version: '1.0.0',
    description: 'Does something amazing',
    type: 'tool' as const,
    enabled: true,
  }

  getToolDefinition() {
    return {
      type: 'function' as const,
      function: {
        name: 'my_custom_tool',
        description: 'Performs custom logic',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Query string' },
          },
          required: ['query'],
        },
      },
    }
  }

  async execute(params: { query: string }): Promise<string> {
    // Your custom logic here
    return `Result for: ${params.query}`
  }

  onLoad() {
    console.log('My custom plugin loaded')
  }

  onUnload() {
    console.log('My custom plugin unloaded')
  }
}
```

### 3. Register Plugin

```typescript
// src/plugins/index.ts
import { MyCustomPlugin } from './custom/my-plugin'

export function loadPlugins(manager: PluginManager) {
  // Load built-in plugins
  manager.register(new MarkdownRendererPlugin())
  
  // Load custom plugin
  manager.register(new MyCustomPlugin())
}
```

## Plugin Manager API

### Register Plugin

```typescript
pluginManager.register(new MyPlugin())
```

### Get Plugin

```typescript
const plugin = pluginManager.get('plugin-id')
```

### Enable/Disable Plugin

```typescript
await pluginManager.enable('plugin-id')
await pluginManager.disable('plugin-id')
```

### List Plugins

```typescript
const allPlugins = pluginManager.list()
const toolPlugins = pluginManager.listByType('tool')
```

### Execute Tool

```typescript
const result = await pluginManager.executeTool('tool-name', { param: 'value' })
```

## Best Practices

### 1. Error Handling

Always handle errors gracefully:

```typescript
async execute(params: any): Promise<string> {
  try {
    // Your logic
    return result
  } catch (error) {
    console.error('Plugin error:', error)
    return 'Error occurred'
  }
}
```

### 2. Cleanup Resources

Always cleanup in `onUnload()`:

```typescript
onUnload() {
  // Close connections
  // Clear timers
  // Remove event listeners
  this.cleanup()
}
```

### 3. Type Safety

Use TypeScript interfaces:

```typescript
interface MyParams {
  query: string
  maxResults?: number
}

async execute(params: MyParams): Promise<string> {
  // Type-safe implementation
}
```

### 4. Configuration

Support configuration options:

```typescript
export class MyPlugin implements ToolPlugin {
  private config: MyConfig

  constructor(config?: Partial<MyConfig>) {
    this.config = {
      timeout: 5000,
      maxRetries: 3,
      ...config,
    }
  }
}
```

### 5. Testing

Write tests for your plugins:

```typescript
describe('MyPlugin', () => {
  it('should process input correctly', async () => {
    const plugin = new MyPlugin()
    const result = await plugin.execute({ query: 'test' })
    expect(result).toBe('expected output')
  })
})
```

## Examples

See `src/plugins/examples/` for complete plugin examples:

- `example-processor.ts` - Message processing
- `example-tool.ts` - Tool implementation
- `example-renderer.ts` - Custom rendering

## Troubleshooting

### Plugin Not Loading

- Check plugin ID is unique
- Verify plugin is registered in `src/plugins/index.ts`
- Check console for error messages

### Tool Not Available to AI

- Verify `getToolDefinition()` returns correct schema
- Check plugin is enabled
- Ensure tool name matches in definition

### Memory Leaks

- Always implement `onUnload()` cleanup
- Remove event listeners
- Clear intervals/timeouts
- Close connections

## Resources

- [Plugin Types](./types.ts) - TypeScript interfaces
- [Plugin Manager](./manager.ts) - Core plugin system
- [Built-in Plugins](./builtin/) - Reference implementations
