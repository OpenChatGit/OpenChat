# Plugin Examples

This directory contains example plugins to demonstrate how to create custom plugins for OpenChat.

## Creating a Custom Plugin

### 1. Choose a Plugin Type

OpenChat supports several plugin types:

- **`message-processor`** - Transform messages before/after sending
- **`renderer`** - Custom rendering for message content
- **`tool`** - Add functions/tools to the chat
- **`storage`** - Custom storage backends
- **`ui-extension`** - Add custom UI components

### 2. Implement the Interface

Create a class that implements the appropriate plugin interface:

```typescript
import type { MessageProcessorPlugin } from '../types'

export class MyPlugin implements MessageProcessorPlugin {
  metadata = {
    id: 'my-plugin',
    name: 'My Custom Plugin',
    version: '1.0.0',
    description: 'Does something cool',
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
    console.log('Plugin loaded!')
  }
}
```

### 3. Register the Plugin

Add your plugin to the plugin manager in `src/hooks/usePlugins.ts`:

```typescript
import { MyPlugin } from '../plugins/examples/MyPlugin'

// In the useEffect:
await pluginManager.register(new MyPlugin())
```

## Example Plugins

### TimestampPlugin

Adds timestamps to outgoing messages. Demonstrates:
- Message processing
- Lifecycle hooks
- Enable/disable functionality

## Plugin Capabilities

### Lifecycle Hooks

All plugins can implement these optional hooks:

- `onLoad()` - Called when plugin is registered
- `onUnload()` - Called when plugin is unregistered
- `onEnable()` - Called when plugin is enabled
- `onDisable()` - Called when plugin is disabled

### Plugin Context

Plugins receive a context object with access to:

- `getCurrentSession()` - Get the current chat session
- `getProviders()` - Get available providers
- `notify()` - Show notifications to the user

## Built-in Plugins

OpenChat includes these built-in plugins:

1. **Markdown Renderer** - Renders markdown with syntax highlighting
2. **Code Copy** - Adds copy buttons to code blocks
3. **Message Export** - Export chats to JSON/Markdown/Text

## Best Practices

1. **Keep plugins focused** - Each plugin should do one thing well
2. **Handle errors gracefully** - Don't crash the app
3. **Use lifecycle hooks** - Clean up resources in `onUnload()`
4. **Make plugins configurable** - Allow users to customize behavior
5. **Document your plugin** - Add clear descriptions and examples
