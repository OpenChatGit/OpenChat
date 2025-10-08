# OpenChat

A highly modular, cross-platform LLM chat application built with Tauri, React, and TypeScript. OpenChat provides a ChatGPT-like interface that works with local AI providers like Ollama, LM Studio, and llama.cpp.

## Features

- 🎨 **Modern UI/UX** - ChatGPT-inspired interface with dark mode support
- 🔌 **Modular Provider System** - Easy to add new LLM providers
- 🧩 **Plugin System** - Extend functionality with custom plugins
- 🚀 **Fast & Native** - Built with Tauri for optimal performance
- 💬 **Streaming Support** - Real-time response streaming
- 📝 **Session Management** - Save and manage multiple chat sessions
- ⚙️ **Flexible Configuration** - Easy provider and model switching
- 🎯 **Markdown Rendering** - Full markdown support with syntax highlighting
- 📊 **Math Support** - LaTeX/KaTeX rendering for mathematical expressions

## Supported Providers

- **Ollama** - Local LLM runtime (default: http://localhost:11434)
- **LM Studio** - Desktop app for running LLMs (default: http://localhost:1234)
- **llama.cpp** - Efficient LLM inference (default: http://localhost:8080)

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Rust (for Tauri)
- One of the supported LLM providers running locally

### Installation

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run Tauri app
npm run tauri dev
```

## Architecture

The project follows a highly modular architecture:

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
├── plugins/         # Plugin system
│   ├── types.ts     # Plugin type definitions
│   ├── PluginManager.ts # Plugin lifecycle management
│   ├── builtin/     # Built-in plugins
│   │   ├── MarkdownPlugin.tsx
│   │   ├── CodeCopyPlugin.tsx
│   │   └── MessageExportPlugin.ts
│   └── examples/    # Example plugins
├── hooks/           # React hooks
│   ├── useChat.ts   # Chat state management
│   ├── useProviders.ts # Provider management
│   └── usePlugins.ts # Plugin management
├── types/           # TypeScript type definitions
└── lib/             # Utility functions
```

## Adding a New Provider

1. Create a new provider class extending `BaseProvider` in `src/providers/`
2. Implement the required methods: `listModels()`, `sendMessage()`, `testConnection()`
3. Add the provider to `ProviderFactory` in `src/providers/factory.ts`
4. Add the provider type to the `ProviderType` union in `src/types/index.ts`

## Creating Custom Plugins

OpenChat has a powerful plugin system. Create custom plugins to extend functionality:

```typescript
import type { MessageProcessorPlugin } from './plugins/types'

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
    return content.toUpperCase()
  }

  onLoad() {
    console.log('Plugin loaded!')
  }
}
```

**Plugin Types:**
- `message-processor` - Transform messages before/after sending
- `renderer` - Custom rendering for message content
- `tool` - Add functions/tools to the chat
- `storage` - Custom storage backends
- `ui-extension` - Add custom UI components

See `src/plugins/examples/` for more examples.

## Configuration

Providers can be configured through the Settings panel:
- Base URL for API endpoints
- API keys (if required)
- Model selection
- Connection testing

## Development

```bash
# Run development server
npm run dev

# Run Tauri in dev mode
npm run tauri dev

# Build for production
npm run build
npm run tauri build
```

## Tech Stack

- **Tauri** - Cross-platform desktop framework
- **React** - UI framework
- **TypeScript** - Type safety
- **TailwindCSS** - Styling
- **Vite** - Build tool
- **Lucide React** - Icons

## License

MIT

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
