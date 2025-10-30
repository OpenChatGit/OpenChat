# PluginLoader - Enhanced Plugin Loading System

The `PluginLoader` class is responsible for discovering, loading, and validating plugins from multiple sources. It supports both built-in plugins (bundled with the app) and external plugins (user-created in AppData directory).

## Features

✅ **Dual Plugin Sources**
- Built-in plugins from `src/plugins/builtin/` (dev) or bundled resources (production)
- External plugins from `AppData/OpenChat/plugins/` (user-created)

✅ **Automatic Discovery**
- Scans plugin directories for `plugin.json` manifests
- Loads plugin code from `index.js`, `index.ts`, or `index.tsx`

✅ **Safe Execution**
- Uses `PluginExecutor` to safely run plugin code in isolated scope
- Injects `pluginAPI` at runtime (no imports needed)

✅ **Validation**
- Validates plugin manifests (required fields, format)
- Validates plugin instances (lifecycle methods, type-specific requirements)

✅ **Dependency Resolution**
- Topological sort for plugin load order
- Detects circular dependencies

✅ **Error Handling**
- Graceful error handling for individual plugin failures
- Detailed error messages for debugging

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    PluginLoader                          │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  loadAll()                                                │
│    ├─> loadBuiltinPlugins()                              │
│    │     ├─> getBuiltinPluginsDirectory()                │
│    │     ├─> scanPluginDirectory()                       │
│    │     └─> loadPlugin() for each                       │
│    │                                                      │
│    └─> loadExternalPlugins()                             │
│          ├─> getExternalPluginsDirectory()               │
│          ├─> ensureDirectory()                           │
│          ├─> scanPluginDirectory()                       │
│          └─> loadPlugin() for each                       │
│                                                           │
│  loadPlugin(path, isBuiltin)                             │
│    ├─> readManifestFromPath()                            │
│    ├─> validateManifest()                                │
│    ├─> readPluginCode()                                  │
│    ├─> PluginExecutor.execute()                          │
│    └─> cache plugin                                      │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Usage

### Basic Usage

```typescript
import { PluginLoader } from './PluginLoader'

const loader = new PluginLoader()

// Load all plugins (built-in + external)
const plugins = await loader.loadAll()

console.log(`Loaded ${plugins.length} plugins`)
```

### Load Only Built-in Plugins

```typescript
const loader = new PluginLoader()

// Load only built-in plugins
const builtinPlugins = await loader.loadBuiltinPlugins()

console.log(`Loaded ${builtinPlugins.length} built-in plugins`)
```

### Load Only External Plugins

```typescript
const loader = new PluginLoader()

// Load only external plugins from AppData
const externalPlugins = await loader.loadExternalPlugins()

console.log(`Loaded ${externalPlugins.length} external plugins`)
```

### Initialize Plugins

```typescript
const loader = new PluginLoader()
const plugins = await loader.loadAll()

// Call onLoad() for each plugin
for (const plugin of plugins) {
  if (plugin.onLoad) {
    await plugin.onLoad()
  }
}
```

### Filter by Type

```typescript
const loader = new PluginLoader()
const plugins = await loader.loadAll()

// Get only renderer plugins
const renderers = plugins.filter(p => {
  const types = Array.isArray(p.metadata.type) 
    ? p.metadata.type 
    : [p.metadata.type]
  return types.includes('renderer')
})
```

### Resolve Dependencies

```typescript
const loader = new PluginLoader()
const plugins = await loader.loadAll()

// Get metadata
const metadata = plugins.map(p => p.metadata)

// Resolve dependencies and get load order
const orderedMetadata = loader.resolveDependencies(metadata)

console.log('Load order:', orderedMetadata.map(m => m.name))
```

## Plugin Directory Structure

### Built-in Plugins (Development)

```
src/plugins/builtin/
  ├── markdown-renderer/
  │   ├── plugin.json
  │   └── index.tsx
  ├── timestamp/
  │   ├── plugin.json
  │   └── index.ts
  └── ...
```

### Built-in Plugins (Production)

```
resources/plugins/builtin/
  ├── markdown-renderer/
  │   ├── plugin.json
  │   └── index.js
  └── ...
```

### External Plugins

```
AppData/OpenChat/plugins/
  ├── my-plugin/
  │   ├── plugin.json
  │   └── index.js
  ├── another-plugin/
  │   ├── plugin.json
  │   └── index.ts
  └── ...
```

## Plugin Manifest (plugin.json)

Every plugin must have a `plugin.json` manifest:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Does something awesome",
  "author": "Your Name",
  "type": "message-processor",
  "appVersion": ">=0.5.0",
  "dependencies": [],
  "permissions": ["storage"],
  "config": {}
}
```

### Required Fields

- `id` - Unique identifier (lowercase, hyphens only)
- `name` - Display name
- `version` - Semantic version (e.g., "1.0.0")
- `description` - Short description
- `author` - Author name
- `type` - Plugin type(s)
- `appVersion` - Minimum app version required

### Optional Fields

- `homepage` - Plugin homepage URL
- `repository` - Git repository URL
- `license` - License identifier (e.g., "MIT")
- `dependencies` - Array of plugin IDs this plugin depends on
- `core` - If true, plugin cannot be disabled
- `permissions` - Array of required permissions
- `config` - Configuration schema

## Plugin Code Structure

### Class-based Plugin

```typescript
class MyPlugin {
  metadata = {
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
    type: 'message-processor',
    enabled: true
  }

  onLoad() {
    console.log('Plugin loaded!')
  }

  onUnload() {
    console.log('Plugin unloaded!')
  }

  processOutgoing(content: string) {
    return content.toUpperCase()
  }
}

// Export the plugin class
export default MyPlugin
// or: module.exports = MyPlugin
```

### Object-based Plugin

```typescript
const myPlugin = {
  metadata: {
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
    type: 'message-processor',
    enabled: true
  },

  onLoad() {
    console.log('Plugin loaded!')
  },

  processOutgoing(content) {
    return content.toUpperCase()
  }
}

export default myPlugin
// or: module.exports = myPlugin
```

## How It Works

### 1. Plugin Discovery

The loader scans plugin directories for folders containing `plugin.json`:

```typescript
// Development mode
src/plugins/builtin/my-plugin/plugin.json

// Production mode (built-in)
resources/plugins/builtin/my-plugin/plugin.json

// External plugins
AppData/OpenChat/plugins/my-plugin/plugin.json
```

### 2. Manifest Loading

For each plugin directory, the loader reads and parses `plugin.json`:

```typescript
const manifest = await readManifestFromPath(pluginPath)
```

### 3. Manifest Validation

The manifest is validated for:
- Required fields (id, name, version, etc.)
- ID format (lowercase, hyphens only)
- Version format (semver)
- Valid plugin type

### 4. Code Loading

The loader reads the plugin code from one of:
- `index.js`
- `index.ts`
- `index.tsx`

```typescript
const code = await readPluginCode(pluginPath)
```

### 5. Code Execution

The code is executed using `PluginExecutor`:

```typescript
const instance = await executor.execute(code, manifest)
```

The executor:
- Wraps the code in an isolated function scope
- Injects `pluginAPI` as a global variable
- Handles both class and object exports
- Returns the plugin instance

### 6. Instance Validation

The plugin instance is validated for:
- Existence and type
- Lifecycle methods (if present)
- Type-specific requirements (e.g., renderer must have `canRender()` and `render()`)

### 7. Caching

The plugin instance and metadata are cached:

```typescript
this.cache.set(pluginPath, instance)
this.metadataCache.set(manifest.id, instance.metadata)
```

## Error Handling

The loader handles errors gracefully:

```typescript
try {
  const plugin = await loadPlugin(dir, isBuiltin)
  if (plugin) {
    plugins.push(plugin)
  }
} catch (error) {
  console.error(`Failed to load plugin from ${dir}:`, error)
  // Continue loading other plugins
}
```

Individual plugin failures don't prevent other plugins from loading.

## Development vs Production

### Development Mode

- Built-in plugins loaded from `src/plugins/builtin/`
- Uses dynamic imports for module loading
- Hot reload supported

### Production Mode

- Built-in plugins loaded from bundled resources
- External plugins loaded from AppData directory
- Uses Tauri file system APIs
- No imports needed in plugin code

## Tauri Integration

The loader uses Tauri APIs for file system access:

```typescript
// Get AppData directory
const { appDataDir, join } = await import('@tauri-apps/api/path')
const appData = await appDataDir()
const pluginsDir = await join(appData, 'plugins')

// Read directory
const { readDir, exists } = await import('@tauri-apps/plugin-fs')
const entries = await readDir(pluginsDir)

// Read files
const { readTextFile } = await import('@tauri-apps/plugin-fs')
const content = await readTextFile(filePath)
```

## Best Practices

1. **Always validate manifests** before loading plugins
2. **Handle errors gracefully** - don't let one bad plugin break everything
3. **Use dependency resolution** to ensure correct load order
4. **Cache plugin instances** for hot reload support
5. **Log detailed information** for debugging
6. **Separate built-in and external plugins** for security

## See Also

- [PluginExecutor](./PluginExecutor.README.md) - Safe plugin code execution
- [PluginManager](./PluginManager.ts) - Plugin lifecycle management
- [Plugin Types](./types.ts) - Type definitions
- [Plugin API](../api/README.md) - API available to plugins
