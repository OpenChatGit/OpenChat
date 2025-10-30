# Hooks Reference

Complete reference for all available plugin hooks in OpenChat.

## What are Hooks?

Hooks are extension points where plugins can inject custom behavior. When a hook is triggered, all registered handlers are called in priority order.

## Hook Registration

```javascript
pluginAPI.hooks.register(hookType, handler, priority)
```

**Parameters:**
- `hookType` (string): The type of hook to register
- `handler` (function): Your hook handler function
- `priority` (number, optional): Execution priority (lower = earlier, default: 100)

**Example:**
```javascript
pluginAPI.hooks.register('message.render.user', (context) => {
  // Modify context
  return context
}, 50)
```

## Available Hooks

### Message Rendering Hooks

#### `message.render.user`

Called when rendering a user message.

**Context:**
```typescript
{
  content: string      // Message content
  role: 'user'        // Message role
  timestamp: Date     // Message timestamp
  metadata: object    // Additional metadata
}
```

**Example:**
```javascript
pluginAPI.hooks.register('message.render.user', (context) => {
  // Add prefix to user messages
  context.content = '👤 ' + context.content
  return context
})
```

#### `message.render.assistant`

Called when rendering an assistant message.

**Context:**
```typescript
{
  content: string         // Message content
  role: 'assistant'      // Message role
  timestamp: Date        // Message timestamp
  metadata: object       // Additional metadata
}
```

**Example:**
```javascript
pluginAPI.hooks.register('message.render.assistant', (context) => {
  // Add prefix to assistant messages
  context.content = '🤖 ' + context.content
  return context
})
```

#### `message.render.system`

Called when rendering a system message.

**Context:**
```typescript
{
  content: string      // Message content
  role: 'system'      // Message role
  timestamp: Date     // Message timestamp
  metadata: object    // Additional metadata
}
```

**Example:**
```javascript
pluginAPI.hooks.register('message.render.system', (context) => {
  // Style system messages
  context.content = '⚙️ ' + context.content
  return context
})
```

### Message Processing Hooks

#### `message.before.send`

Called before a message is sent to the AI.

**Context:**
```typescript
{
  content: string      // Message content
  role: 'user'        // Message role
  metadata: object    // Additional metadata
}
```

**Example:**
```javascript
pluginAPI.hooks.register('message.before.send', (context) => {
  // Add instructions to every message
  context.content += '\n\nPlease be concise.'
  return context
})
```

#### `message.after.receive`

Called after receiving a message from the AI.

**Context:**
```typescript
{
  content: string         // Message content
  role: 'assistant'      // Message role
  metadata: object       // Additional metadata
}
```

**Example:**
```javascript
pluginAPI.hooks.register('message.after.receive', (context) => {
  // Log received messages
  console.log('Received:', context.content)
  return context
})
```

### UI Extension Hooks

#### `ui.toolbar`

Called when rendering the toolbar. Return UI elements to add to the toolbar.

**Context:**
```typescript
{
  position: 'left' | 'right' | 'center'
}
```

**Return:** React component or HTML element

**Example:**
```javascript
pluginAPI.hooks.register('ui.toolbar', (context) => {
  return {
    id: 'my-button',
    label: 'My Action',
    icon: 'star',
    onClick: () => {
      pluginAPI.ui.showNotification('Clicked!', 'success')
    }
  }
})
```

#### `ui.sidebar`

Called when rendering the sidebar. Return UI elements to add to the sidebar.

**Context:**
```typescript
{
  position: 'top' | 'bottom'
}
```

**Return:** React component or HTML element

**Example:**
```javascript
pluginAPI.hooks.register('ui.sidebar', (context) => {
  return {
    id: 'my-panel',
    title: 'My Panel',
    content: '<div>Custom content</div>'
  }
})
```

#### `ui.message.actions`

Called when rendering message action buttons. Return additional actions.

**Context:**
```typescript
{
  message: {
    content: string
    role: string
    timestamp: Date
  }
}
```

**Return:** Array of action objects

**Example:**
```javascript
pluginAPI.hooks.register('ui.message.actions', (context) => {
  return [{
    id: 'translate',
    label: 'Translate',
    icon: 'globe',
    onClick: () => {
      console.log('Translate:', context.message.content)
    }
  }]
})
```

### Session Hooks

#### `session.create`

Called when a new session is created.

**Context:**
```typescript
{
  sessionId: string
  title: string
  timestamp: Date
}
```

**Example:**
```javascript
pluginAPI.hooks.register('session.create', (context) => {
  console.log('New session:', context.sessionId)
  return context
})
```

#### `session.delete`

Called when a session is deleted.

**Context:**
```typescript
{
  sessionId: string
}
```

**Example:**
```javascript
pluginAPI.hooks.register('session.delete', (context) => {
  console.log('Session deleted:', context.sessionId)
  return context
})
```

#### `session.switch`

Called when switching between sessions.

**Context:**
```typescript
{
  fromSessionId: string
  toSessionId: string
}
```

**Example:**
```javascript
pluginAPI.hooks.register('session.switch', (context) => {
  console.log('Switched from', context.fromSessionId, 'to', context.toSessionId)
  return context
})
```

### Application Hooks

#### `app.startup`

Called when the application starts.

**Context:**
```typescript
{
  version: string
  platform: string
}
```

**Example:**
```javascript
pluginAPI.hooks.register('app.startup', (context) => {
  console.log('App started:', context.version)
  return context
})
```

#### `app.shutdown`

Called when the application is shutting down.

**Context:**
```typescript
{
  reason: string
}
```

**Example:**
```javascript
pluginAPI.hooks.register('app.shutdown', (context) => {
  // Save state before shutdown
  pluginAPI.storage.set('lastShutdown', new Date().toISOString())
  return context
})
```

### Settings Hooks

#### `settings.change`

Called when application settings change.

**Context:**
```typescript
{
  key: string
  oldValue: any
  newValue: any
}
```

**Example:**
```javascript
pluginAPI.hooks.register('settings.change', (context) => {
  if (context.key === 'theme') {
    console.log('Theme changed to:', context.newValue)
  }
  return context
})
```

## Hook Priorities

Hooks are executed in priority order (lower number = earlier execution):

- **0-25**: Critical system hooks
- **26-50**: High priority plugins
- **51-100**: Normal priority (default: 100)
- **101-200**: Low priority plugins
- **201+**: Cleanup and logging hooks

**Example:**
```javascript
// This runs first
pluginAPI.hooks.register('message.render.user', handler1, 10)

// This runs second
pluginAPI.hooks.register('message.render.user', handler2, 50)

// This runs last (default priority)
pluginAPI.hooks.register('message.render.user', handler3)
```

## Hook Best Practices

### 1. Always Return Context

```javascript
// ✅ Good
pluginAPI.hooks.register('message.render.user', (context) => {
  context.content = context.content.toUpperCase()
  return context
})

// ❌ Bad - doesn't return context
pluginAPI.hooks.register('message.render.user', (context) => {
  context.content = context.content.toUpperCase()
})
```

### 2. Handle Errors Gracefully

```javascript
pluginAPI.hooks.register('message.render.user', (context) => {
  try {
    // Your code here
    context.content = processContent(context.content)
  } catch (error) {
    console.error('Hook error:', error)
    // Return original context on error
  }
  return context
})
```

### 3. Don't Block Execution

```javascript
// ✅ Good - async operations
pluginAPI.hooks.register('message.before.send', async (context) => {
  const data = await pluginAPI.storage.get('data')
  context.metadata.data = data
  return context
})

// ❌ Bad - synchronous blocking
pluginAPI.hooks.register('message.before.send', (context) => {
  // Don't do heavy computation here
  for (let i = 0; i < 1000000; i++) {
    // This blocks the UI
  }
  return context
})
```

### 4. Clean Up on Unload

```javascript
class MyPlugin {
  onLoad() {
    pluginAPI.hooks.register('message.render.user', this.handleMessage)
  }
  
  onUnload() {
    // Unregister hooks when plugin unloads
    pluginAPI.hooks.unregister('message.render.user')
  }
  
  handleMessage(context) {
    return context
  }
}
```

### 5. Use Appropriate Priority

```javascript
// High priority - runs early
pluginAPI.hooks.register('message.render.user', handler, 25)

// Normal priority - default
pluginAPI.hooks.register('message.render.user', handler)

// Low priority - runs late
pluginAPI.hooks.register('message.render.user', handler, 150)
```

## Hook Chaining

Multiple plugins can register the same hook. They execute in priority order, with each receiving the modified context from the previous handler:

```javascript
// Plugin A (priority 50)
pluginAPI.hooks.register('message.render.user', (context) => {
  context.content = '[A] ' + context.content
  return context
}, 50)

// Plugin B (priority 100)
pluginAPI.hooks.register('message.render.user', (context) => {
  context.content = '[B] ' + context.content
  return context
}, 100)

// Result: "[B] [A] Original message"
```

## Async Hooks

Hooks can be async. The system will wait for them to complete:

```javascript
pluginAPI.hooks.register('message.before.send', async (context) => {
  // Fetch data from storage
  const settings = await pluginAPI.storage.get('settings')
  
  // Apply settings
  if (settings.addTimestamp) {
    context.content += `\n\nTimestamp: ${new Date().toISOString()}`
  }
  
  return context
})
```

## Hook Timeout

Hooks have a 5-second timeout. If your hook takes longer, it will be cancelled:

```javascript
// ❌ This will timeout
pluginAPI.hooks.register('message.render.user', async (context) => {
  await new Promise(resolve => setTimeout(resolve, 10000)) // 10 seconds
  return context
})

// ✅ This is fine
pluginAPI.hooks.register('message.render.user', async (context) => {
  await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second
  return context
})
```

## Debugging Hooks

Use console logging to debug your hooks:

```javascript
pluginAPI.hooks.register('message.render.user', (context) => {
  console.log('Hook called with:', context)
  
  // Your code here
  context.content = context.content.toUpperCase()
  
  console.log('Hook returning:', context)
  return context
})
```

## Future Hooks

These hooks are planned for future releases:

- `message.edit` - When a message is edited
- `message.delete` - When a message is deleted
- `file.upload` - When a file is uploaded
- `file.download` - When a file is downloaded
- `search.query` - When searching messages
- `export.format` - When exporting conversations
- `theme.change` - When theme changes
- `plugin.install` - When a plugin is installed
- `plugin.uninstall` - When a plugin is uninstalled

Stay tuned for updates! 🚀
