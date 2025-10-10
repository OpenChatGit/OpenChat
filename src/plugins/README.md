# OpenChat Plugin System

A modular and extensible plugin system for OpenChat.

## 📁 Directory Structure

```
src/plugins/
├── core/                    # Core plugins (developed by OpenChat Team)
│   ├── markdown-renderer/   # Markdown rendering with syntax highlighting
│   ├── code-copy/          # Copy button for code blocks
│   └── web-search/         # Web search with RAG
│
├── external/               # External plugins (Community & Third-party)
│   ├── message-export/     # Chat export (JSON, Markdown, Text)
│   └── examples/          # Example plugins for learning
│
├── PLUGIN_TEMPLATE/        # Template for new plugins
├── PluginManager.ts        # Plugin management
├── types.ts               # TypeScript types
└── index.ts              # Main export
```

## 🔑 Core vs. External Plugins

### Core Plugins (`core/`)
- ✅ **Developed by OpenChat Team**
- ✅ **Always enabled** - cannot be disabled
- ✅ **Essential for app functionality**
- ✅ **Well tested and maintained**
- ✅ `"core": true` in plugin.json

**Examples:**
- Markdown Renderer
- Web Search Tool
- Code Copy Component

### External Plugins (`external/`)
- 🌍 **Community and third-party**
- 🔄 **Can be enabled/disabled**
- 🎨 **Extend functionality**
- 📦 **Easy to add/remove**
- 🔄 `"core": false` in plugin.json

**Examples:**
- Message Export
- Custom Integrations
- Experimental Features

## 🚀 Quick Start

### 1. Choose the Right Directory

**OpenChat Team member?** → `core/`  
**Community developer?** → `external/`

### 2. Create Plugin Structure

```
your-plugin/
├── plugin.json    # Plugin manifest (REQUIRED)
├── index.ts       # Plugin implementation (REQUIRED)
└── README.md      # Documentation (RECOMMENDED)
```

### 3. That's It!

Your plugin will be **automatically discovered and loaded**. No manual registration needed!

See [CREATING_PLUGINS.md](./CREATING_PLUGINS.md) for detailed guide.

## 📚 Plugin Types

- **`message-processor`** - Transform messages before/after sending
- **`renderer`** - Custom rendering for message content
- **`tool`** - Add functions/tools to the chat
- **`storage`** - Custom storage backends
- **`ui-extension`** - Add custom UI components

## 🔧 Plugin Registration

### Automatic (Recommended)
Just create your plugin folder in `core/` or `external/`. It will be automatically discovered!

### Manual (Advanced)
```typescript
// src/hooks/usePlugins.ts
import { YourPlugin } from '../plugins/external/your-plugin'

await pluginManager.register(new YourPlugin())
```

## 📖 Examples

Check out these plugins as reference:

- **Renderer**: `core/markdown-renderer/`
- **Tool**: `core/web-search/`
- **Export**: `external/message-export/`
- **Template**: `PLUGIN_TEMPLATE/`

## 🛠️ Best Practices

### ✅ DO
- Keep plugins focused on one task
- Handle errors gracefully
- Clean up resources in `onUnload()`
- Document your plugin
- Use semantic versioning
- Test with different providers

### ❌ DON'T
- Don't crash the app on errors
- Don't modify global state directly
- Don't create memory leaks
- Don't hardcode values
- Don't skip the manifest file
- Don't use generic IDs

## 📝 Migration from Old Structure

If you have old imports:

```typescript
// ❌ OLD (removed)
import { Plugin } from '../plugins/builtin'
import { Tool } from '../global_tools'

// ✅ NEW
import { Plugin } from '../plugins/core'
import { Tool } from '../plugins/external'
```

## 🤝 Contributing

1. Fork the repository
2. Create your plugin in `external/`
3. Test thoroughly
4. Create a Pull Request
5. Document your plugin

## 📞 Need Help?

- Read [CREATING_PLUGINS.md](./CREATING_PLUGINS.md)
- Check existing plugins
- Read types in `types.ts`
- Open an issue on GitHub
