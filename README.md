![OpenChat screenshot](https://i.imgur.com/h8yBEzR.png)

# OpenChat

OpenChat is a modular, cross-platform LLM chat application built with Tauri, React, and TypeScript. It delivers a ChatGPT-style interface that connects seamlessly to local AI providers such as Ollama, LM Studio, and llama.cpp.

## Table of Contents

- [Features](#features)
- [Supported Providers](#supported-providers)
- [Getting Started](#getting-started)
- [Architecture](#architecture)
- [Adding a New Provider](#adding-a-new-provider)
- [Advanced Plugin System](#advanced-plugin-system)
- [Creating Custom Plugins](#creating-custom-plugins)
- [Configuration](#configuration)
- [Development](#development)
- [Tech Stack](#tech-stack)
- [License](#license)
- [Recommended IDE Setup](#recommended-ide-setup)

## Features

- **Modern interface** – ChatGPT-inspired layout with clean white/dark theme.
- **Advanced Plugin System** – Robust, generic plugin architecture with UI extensions (IMPROVED!)
- **Global Tooling System** – Flexible plugin architecture for AI tools
- **Memory System** – AI can create and retrieve memories across conversations
- **Intelligent Web Search** – Automatic web search with RAG processing and source citations
- **Reasoning Block** – Collapsible reasoning display for models that use `<think>` tags
- **Modular provider system** – Plug in new LLM providers without touching core code.
- **Plugin runtime** – Extend the chat experience with custom plugins.
- **Native performance** – Tauri application shell keeps the UI fast and lightweight.
- **Streaming responses** – Display tokens as soon as they arrive from the model.
- **Session management** – Create, persist, and revisit conversations.
- **Flexible configuration** – Switch providers, models, and credentials from the UI.
- **Rich Markdown support** – Render code blocks, tables, and inline formatting.
- **Mathematical rendering** – Render LaTeX expressions through KaTeX.

## Supported Providers

| Provider | Default endpoint | Notes |
| --- | --- | --- |
| **Ollama** | `http://localhost:11434` | Local LLM runtime and default backend. |
| **LM Studio** | `http://localhost:1234` | Desktop application for running quantized models. |
| **llama.cpp** | `http://localhost:8080` | High-performance inference server for GGUF models. |

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Rust (for Tauri)
- One of the supported LLM providers running locally

### Installation

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/OpenChatGit/OpenChat.git
   npm install
   ```

2. Start the React development server:

   ```bash
   npm run dev
   ```

3. Launch the desktop shell with Tauri:

   ```bash
   npm run tauri dev
   ```

4. Build production artifacts when you are ready to ship:

   ```bash
   npm run build
   npm run tauri build
   ```

## Architecture

OpenChat keeps UI, provider integrations, and plugin logic decoupled to simplify maintenance and extension:

```
src/
├── components/       # React UI components
│   ├── ui/          # Reusable UI components
│   ├── Sidebar.tsx  # Chat session sidebar
│   ├── ChatArea.tsx # Main chat interface
│   └── Settings.tsx # Provider configuration
├── providers/       # Provider implementations
│   ├── base.ts      # Base provider interface
│   ├── ollama.ts    # Ollama provider
│   ├── lmstudio.ts  # LM Studio provider
│   ├── llamacpp.ts  # llama.cpp provider
│   └── factory.ts   # Provider factory
├── plugins/         # Plugin system (auto-discovery)
│   ├── core/        # Core plugins (always enabled)
│   │   ├── markdown-renderer/  # Markdown rendering
│   │   ├── web-search/         # Web search tool
│   │   └── memory/             # Memory system tool (NEW!)
│   ├── external/    # Community plugins (optional)
│   │   └── message-export/     # Export conversations
│   ├── types.ts     # Plugin type definitions
│   ├── PluginManager.ts # Plugin lifecycle & tool execution
│   └── loader.ts    # Auto-discovery system
├── hooks/           # React hooks
│   ├── useChat.ts   # Chat state management
│   ├── useProviders.ts # Provider management
│   └── usePlugins.ts # Plugin management
├── types/           # TypeScript type definitions
└── lib/             # Utility functions
```

## Global Tooling System

OpenChat features a **flexible tool plugin architecture** that allows AI models to use various tools to enhance their capabilities.

### Available Tools

#### 🔍 Web Search (`{web_search}`)
- Searches the web for current information
- Uses RAG (Retrieval-Augmented Generation) for context processing
- Provides source citations
- **Usage**: Automatically triggered for current events, recent info, facts

#### 🧠 Memory System (`{create_memory}`, `{search_memories}`, `{list_memories}`)
- Create persistent memories across conversations
- Search through stored information
- Tag and organize memories
- **Usage**: "Remember that I prefer dark mode" → AI creates memory

### How It Works

```
User: "What are the best laptops in 2025?"

AI Decision:
1. Recognizes "best" and "2025" require current information
2. Calls {web_search} with query "best laptops 2024"
3. Receives search results with sources
4. Provides structured answer with citations
```

### Tool Call Syntax

Tools use a simple syntax: `{tool_name}` with JSON parameters:
```json
{
  "tool_calls": [{
    "function": {
      "name": "create_memory",
      "arguments": {
        "content": "User prefers TypeScript",
        "tags": ["preference"]
      }
    }
  }]
}
```

For detailed documentation, see [AGENT_SYSTEM.md](./AGENT_SYSTEM.md)

## Advanced Plugin System

OpenChat features a **robust, generic plugin system** that allows you to extend functionality without modifying core code. The system is fully dynamic - plugins are automatically enabled/disabled based on their state.

### Key Improvements

- ✅ **Generic Architecture** – No hardcoding, works with any plugin
- ✅ **Location-Based Rendering** – Plugins define where they appear
- ✅ **Automatic Management** – Enable/disable plugins dynamically
- ✅ **Type-Safe** – Full TypeScript support
- ✅ **Scalable** – Add unlimited plugins without code changes

### Plugin Types

| Type | Purpose | Example |
|------|---------|---------|
| `ui-extension` | Add UI components | Timestamps, reactions, custom buttons |
| `message-processor` | Transform messages | Auto-translate, filters, formatters |
| `renderer` | Custom rendering | LaTeX, diagrams, syntax highlighting |
| `tool` | Add AI functions | Web search, calculations, API calls |
| `storage` | Custom storage | Cloud sync, encryption |
| `reasoning-detector` | Parse reasoning | Extract thinking process |

### UI Extension Locations

UI extensions can be placed in specific locations:

- `user-message-footer` – Below user messages
- `ai-message-footer` – Below AI responses
- `sidebar` – In the sidebar panel
- `toolbar` – In the main toolbar
- `message-actions` – Message action buttons
- `settings` – Settings panel

### Example: Timestamp Plugin

**Plugin Disabled:**

![Plugin OFF - No timestamps](https://i.imgur.com/wafI78P.png)

**Plugin Enabled:**

![Plugin ON - Timestamps visible](https://i.imgur.com/nIp5XiE.png)

### Comparison: Before & After

| Without Plugin | With Plugin |
|----------------|-------------|
| ![Before](https://i.imgur.com/PlNgr1x.png) | ![After](https://i.imgur.com/N1KusWt.png) |

### How It Works

```typescript
// 1. Plugin defines its location and component
export class TimestampPlugin implements UIExtensionPlugin {
  metadata = { enabled: true, type: 'ui-extension' }
  location = 'user-message-footer'
  component = TimestampDisplay
}

// 2. System automatically loads enabled plugins
const uiExtensions = pluginManager.getByType('ui-extension')

// 3. Components render at specified locations
{uiExtensions
  .filter(ext => ext.location === 'user-message-footer')
  .map(ext => <ext.component message={message} />)
}
```

**Result:** Plugin enabled → Component renders. Plugin disabled → Component hidden. No code changes needed!

### Creating Your Own Plugin

See [Creating Custom Plugins](#creating-custom-plugins) for detailed instructions and the plugin template.

## Intelligent Web Search

OpenChat includes an intelligent web search system that enriches model answers with current web information:

- **Coordinator** – `WebSearchTool` in `src/plugins/core/web-search/index.ts` orchestrates querying, scraping, caching, and formatting.
- **Web Scraping** – `WebScraper` in `src/plugins/core/web-search/scraper.ts` retrieves and processes web content.
- **RAG processing** – `RAGProcessor` in `src/plugins/core/web-search/rag.ts` chunks content, ranks relevance, and synthesizes summaries with citations.
- **Automatic triggers** – The Agent System automatically decides when to search based on context and trigger words.

The system queries DuckDuckGo without API keys and returns structured context with source citations.

## Adding a New Provider

1. Create a new provider class extending `BaseProvider` in `src/providers/`
2. Implement the required methods: `listModels()`, `sendMessage()`, `testConnection()`
3. Add the provider to `ProviderFactory` in `src/providers/factory.ts`
4. Add the provider type to the `ProviderType` union in `src/types/index.ts`

## Creating Custom Plugins

OpenChat features an **auto-discovery plugin system** - just create your plugin folder and it will be automatically loaded!

### Quick Start (3 Steps)

1. **Create plugin folder** in `src/plugins/external/your-plugin/`
2. **Add required files:**
   - `plugin.json` - Plugin manifest
   - `index.ts` - Plugin implementation
   - `README.md` - Documentation (optional)
3. **Done!** Your plugin is automatically discovered and loaded

### Example Plugin

```typescript
// src/plugins/external/my-plugin/index.ts
import type { ToolPlugin, PluginMetadata } from '../../types'
import manifestData from './plugin.json'

export class MyPlugin implements ToolPlugin {
  metadata: PluginMetadata & { type: 'tool' } = {
    ...(manifestData as any),
    enabled: true,
  }

  getTool() {
    return {
      name: 'my_tool',
      description: 'Does something cool',
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

**Plugin Types:**
- `message-processor` – Transform messages before or after they are sent to a provider
- `renderer` – Customize how content is displayed in the chat transcript
- `tool` – Provide callable utilities that models can invoke
- `storage` – Implement alternative persistence layers for sessions and metadata
- `ui-extension` – Mount additional UI panels or controls

**For detailed documentation, see [PLUGIN_DEVELOPMENT.md](./PLUGIN_DEVELOPMENT.md)**

## Configuration

Providers can be configured through the Settings panel:
- Base URL or host for each provider endpoint.
- API keys or access tokens when a provider requires authentication.
- Default model selection per provider profile.
- Connection diagnostics for ensuring the backend is reachable.

## Development

Use the scripts in `package.json` to streamline your workflow:

- `npm run dev` – Runs the Vite development server with fast HMR.
- `npm run tauri dev` – Boots the Tauri desktop shell for local testing.
- `npm run build` – Produces optimized assets for deployment.
- `npm run tauri build` – Generates platform-specific binaries.

## Tech Stack

- **Tauri** – Lightweight desktop shell that wraps the web UI.
- **React** – Component-driven UI development.
- **TypeScript** – Static typing across the entire application.
- **TailwindCSS** – Utility-first styling system.
- **Vite** – Modern build tooling for fast iteration.
- **Lucide React** – Icon library used throughout the interface.

## License

MIT

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
