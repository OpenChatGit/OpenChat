# Core Plugins

This directory contains **core plugins** developed and maintained by the OpenChat Team.

## 🔒 What are Core Plugins?

Core Plugins are:
- Developed by the OpenChat Team
- **Always enabled** - cannot be disabled
- Essential for base functionality
- Well tested and maintained
- `"core": true` in plugin.json

## 📦 Available Core Plugins

### Markdown Renderer
**Path**: `markdown-renderer/`  
**Type**: Renderer  
**Description**: Renders Markdown content with syntax highlighting, math support and GFM

**Features**:
- Syntax highlighting for code blocks
- Math rendering (KaTeX)
- GitHub Flavored Markdown (GFM)
- Tables, lists, links
- Custom styling

### Web Search
**Path**: `web-search/`  
**Type**: Tool  
**Description**: Intelligent web search with RAG (Retrieval-Augmented Generation)

**Features**:
- DuckDuckGo search
- Content scraping
- Intelligent chunking
- Relevance ranking
- Automatic detection when search is needed
- Caching for performance

### Code Copy
**Path**: `code-copy/`  
**Type**: Component  
**Description**: Copy button component for code blocks

**Features**:
- One-click copy
- Visual feedback
- Hover activation
- Universal language support

## ➕ Adding a New Core Plugin

**For OpenChat Team members only**

### 1. Create Plugin Folder
```
core/
└── your-plugin/
    ├── plugin.json
    ├── index.ts
    └── README.md
```

### 2. Set core: true
```json
{
  "id": "your-core-plugin",
  "name": "Your Core Plugin",
  "version": "1.0.0",
  "description": "Essential functionality",
  "author": "OpenChat Team",
  "type": "tool",
  "appVersion": "0.1.0",
  "core": true
}
```

### 3. Implement the Plugin
```typescript
import type { ToolPlugin, PluginMetadata } from '../../types'
import manifestData from './plugin.json'

export class YourCorePlugin implements ToolPlugin {
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
    console.log(`[${this.metadata.name}] v${this.metadata.version} loaded`)
  }
}
```

### 4. Export in index.ts
```typescript
// core/index.ts
export { YourCorePlugin } from './your-plugin'
```

### 5. Register in usePlugins.ts
```typescript
import { YourCorePlugin } from '../plugins/core'

// In initPlugins() unter CORE plugins:
await pluginManager.register(new YourCorePlugin())
```

## 🛡️ Quality Standards

Core Plugins must:
- ✅ Be fully tested
- ✅ Handle errors gracefully
- ✅ Be performance optimized
- ✅ Be well documented
- ✅ Be TypeScript typed
- ✅ Work with all providers
- ✅ No breaking changes without migration

## 📚 Resources

- [Plugin Creation Guide](../CREATING_PLUGINS.md)
- [Plugin Types](../types.ts)
- [Plugin Manager](../PluginManager.ts)

## ⚠️ Important

Core Plugins **cannot** be disabled by users. Make sure that:
- They are truly essential
- They are stable and tested
- They don't contain optional features
- They don't impact performance

For optional features, use `external/` instead.
