# PluginExecutor

The `PluginExecutor` is the core component that safely executes plugin code in an isolated scope with an injected `pluginAPI` object. This is what makes external plugins work without requiring imports or access to OpenChat source code.

## Key Features

✅ **Runtime API Injection** - Injects `pluginAPI` at runtime (no imports needed)  
✅ **Isolated Execution** - Executes plugin code in separate scope  
✅ **Multiple Export Patterns** - Handles both class and object exports  
✅ **Comprehensive Validation** - Validates plugin instances with helpful error messages  
✅ **Type Safety** - Full TypeScript support with detailed error classes  

## How It Works

### 1. Code Wrapping

The executor wraps user plugin code in a function that receives `pluginAPI` as a parameter:

```typescript
(function(pluginAPI, module, exports) {
  'use strict';
  
  // User's plugin code is executed here
  // pluginAPI is available as a global variable
  ${userCode}
  
  // Return plugin class/object
  if (typeof module.exports === 'function') {
    return new module.exports()
  }
  // ... handle other export patterns
})
```

### 2. API Injection

The `pluginAPI` object is created specifically for each plugin with scoped access:

```typescript
const pluginAPI = createPluginAPI(pluginId, manifest)
const instance = fn(pluginAPI, module, exports)
```

### 3. Validation

After execution, the plugin instance is validated to ensure it has the correct structure:

- Checks if instance exists and is an object
- Validates lifecycle methods are functions
- Validates type-specific requirements (e.g., renderer must have `canRender()` and `render()`)

## Supported Export Patterns

### Pattern 1: Class Export (CommonJS)

```javascript
class MyPlugin {
  onLoad() {
    pluginAPI.hooks.register('message.render.user', (context) => {
      return '<div>Custom UI</div>'
    })
  }
}

module.exports = MyPlugin
```

### Pattern 2: Object Export (CommonJS)

```javascript
module.exports = {
  onLoad() {
    pluginAPI.ui.showNotification('Plugin loaded!', 'success')
  },
  
  onUnload() {
    console.log('Cleanup')
  }
}
```

### Pattern 3: ES6 Default Export

```javascript
class MyPlugin {
  onLoad() {
    pluginAPI.storage.set('initialized', true)
  }
}

export default MyPlugin
```

## Error Handling

The executor provides three types of errors with detailed messages:

### PluginSyntaxError

Thrown when plugin code has syntax errors:

```typescript
throw new PluginSyntaxError(
  'my-plugin',
  'Syntax error in plugin code: Unexpected token',
  originalError
)
```

### PluginExecutionError

Thrown when plugin code fails during execution:

```typescript
throw new PluginExecutionError(
  'my-plugin',
  'Runtime error during plugin execution: Cannot read property...',
  originalError
)
```

### PluginValidationError

Thrown when plugin instance doesn't meet requirements:

```typescript
throw new PluginValidationError(
  'my-plugin',
  'Renderer plugin must implement canRender() method'
)
```

## Usage Example

```typescript
import { pluginExecutor } from './PluginExecutor'

const manifest = {
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  description: 'Example plugin',
  author: 'Me',
  type: 'ui-extension',
  appVersion: '>=0.5.0'
}

const code = `
class MyPlugin {
  onLoad() {
    pluginAPI.ui.showNotification('Hello!', 'info')
  }
}

module.exports = MyPlugin
`

try {
  const plugin = await pluginExecutor.execute(code, manifest)
  console.log('Plugin loaded:', plugin.metadata.name)
  
  // Call lifecycle methods
  if (plugin.onLoad) {
    await plugin.onLoad()
  }
  
} catch (error) {
  if (error instanceof PluginValidationError) {
    console.error('Validation failed:', error.message)
  } else if (error instanceof PluginSyntaxError) {
    console.error('Syntax error:', error.message)
  } else {
    console.error('Execution failed:', error.message)
  }
}
```

## Type-Specific Validation

The executor validates plugins based on their declared type:

| Type | Required Methods | Required Properties |
|------|-----------------|---------------------|
| `renderer` | `canRender()`, `render()` | - |
| `message-processor` | `processOutgoing()` or `processIncoming()` | - |
| `tool` | `getTool()`, `execute()` | - |
| `ui-extension` | - | `location`, `component` |
| `command` | `getCommand()`, `execute()` | - |

## Security Considerations

1. **Scope Isolation** - Plugin code runs in isolated function scope
2. **No Direct Access** - Plugins cannot access OpenChat internals
3. **API Whitelisting** - Only exposed APIs are available
4. **Namespace Isolation** - Each plugin has its own storage namespace

## Why This Works in Production

External plugins work in the compiled `.exe` because:

1. ✅ No imports required - `pluginAPI` is injected at runtime
2. ✅ No React imports - UI is handled through hooks
3. ✅ No access to `src/` - Everything goes through the API
4. ✅ Standard JavaScript - Uses Function constructor for execution
5. ✅ File system access - Tauri reads plugin files from AppData

## Integration with Plugin System

The PluginExecutor is used by the PluginLoader:

```typescript
// In PluginLoader
const code = await readPluginCode(pluginPath)
const manifest = await readPluginManifest(pluginPath)

const plugin = await pluginExecutor.execute(code, manifest)

// Plugin is now ready to use!
```

## Best Practices

1. **Always validate** - Let the executor validate plugins before use
2. **Handle errors** - Catch and log execution errors gracefully
3. **Provide context** - Include manifest for better error messages
4. **Test patterns** - Test all export patterns (class, object, ES6)
5. **Document API** - Keep pluginAPI documentation up to date

## Future Enhancements

- [ ] Timeout protection for long-running plugin code
- [ ] Memory usage monitoring
- [ ] Performance profiling
- [ ] Hot reload support
- [ ] Plugin dependency resolution

