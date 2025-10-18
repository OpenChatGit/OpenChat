![OpenChat screenshot](https://i.imgur.com/5h9F6rg.png)

# OpenChat

![Version](https://img.shields.io/badge/version-0.4.6%20(test)-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

OpenChat is a modular, cross-platform LLM chat application built with Tauri, React, and TypeScript. It delivers a ChatGPT-style interface that connects seamlessly to local AI providers such as Ollama, LM Studio, and llama.cpp.

> ⚠️ **Notice:** Experimental features have been integrated into the main branch as best as possible. Some features may still be in development or require additional testing. Please report any issues you encounter.

## Table of Contents

- [Features](#features)
- [Supported Providers](#supported-providers)
- [Getting Started](#getting-started)
- [Web Search System](#web-search-system)
- [Adding a New Provider](#adding-a-new-provider)
- [Creating Custom Plugins](#creating-custom-plugins)
- [Configuration](#configuration)
- [Development](#development)
- [Tech Stack](#tech-stack)
- [License](#license)
- [Recommended IDE Setup](#recommended-ide-setup)

## Features

- **Modern interface** – ChatGPT-inspired layout with full dark-mode support.
- **Modular provider system** – Plug in new LLM providers without touching core code.
- **Plugin runtime** – Extend the chat experience with custom plugins.
- **Native performance** – Tauri application shell keeps the UI fast and lightweight.
- **Streaming responses** – Display tokens as soon as they arrive from the model.
- **Session management** – Create, persist, and revisit conversations.
- **Flexible configuration** – Switch providers, models, and credentials from the UI.
- **Rich Markdown support** – Render code blocks, tables, and inline formatting.
- **Mathematical rendering** – Render LaTeX expressions through KaTeX.
- **Free web search** – Completely rebuilt web search system that's 100% free, with no API keys required. Features intelligent auto-detection, backend scraping, and a streamlined UI with real-time search indicators.

## Supported Providers

| Provider | Default endpoint | Notes |
| --- | --- | --- |
| **Ollama** | `http://localhost:11434` | Local LLM runtime and default backend. |
| **LM Studio** | `http://localhost:1234` | Desktop application for running quantized models. |
| **llama.cpp** | `http://localhost:8080` | High-performance inference server for GGUF models. |

> 📢 **Deprecation Notice:** LM Studio integration will be removed in upcoming updates. Despite this project being largely built around LM Studio, there were disagreements in the LM Studio Discord regarding alleged self-promotion (which never occurred), and the project was deemed "out of scope" for their community. We respect their decision and will focus on other providers moving forward.

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

## Web Search System

OpenChat features a completely rebuilt web search system that's **100% free** and requires **no API keys**. The new architecture provides intelligent, automatic web search capabilities with a clean, minimal UI.

### Key Features

- **Completely Free** – No API keys, no costs, no limits. Uses DuckDuckGo search with backend scraping.
- **Intelligent Auto-Detection** – Automatically determines when web search would be beneficial based on query analysis.
- **Backend Scraping** – Rust-based Tauri backend handles all web scraping, eliminating the need for Puppeteer or browser dependencies.
- **Streamlined UI** – Minimal, elegant search indicators:
  - "Searching web" with animated spinner during search
  - "Searched Web" with source favicons (up to 5) after completion
- **RAG Processing** – Chunks content, ranks relevance, and injects structured context into model prompts.
- **Event-Driven Architecture** – Real-time progress updates through a clean event system.
- **Lazy Loading** – Search components are loaded on-demand to keep the initial bundle size small.

### Architecture

- **AutoSearchManager** (`src/lib/web-search/autoSearchManager.ts`) – Orchestrates search decisions, execution, and context injection.
- **SearchOrchestrator** (`src/lib/web-search/searchOrchestrator.ts`) – Coordinates search queries, scraping, and RAG processing.
- **BackendScraper** (`src/lib/web-search/backendScraper.ts`) – Interfaces with Tauri backend for efficient web scraping.
- **LazyLoader** (`src/lib/web-search/lazyLoader.ts`) – Dynamically loads search components to optimize performance.
- **SearchEvents** (`src/lib/web-search/searchEvents.ts`) – Event system for real-time search progress updates.

The system automatically triggers on relevant queries, scrapes content from multiple sources, processes it through RAG, and seamlessly injects the context into your conversation—all without any configuration or API keys.

## Adding a New Provider

1. Create a new provider class extending `BaseProvider` in `src/providers/`
2. Implement the required methods: `listModels()`, `sendMessage()`, `testConnection()`
3. Add the provider to `ProviderFactory` in `src/providers/factory.ts`
4. Add the provider type to the `ProviderType` union in `src/types/index.ts`

## Creating Custom Plugins

OpenChat exposes a plugin API that allows you to extend message processing, rendering, tooling, and storage. The example below shows the minimal structure of a message processor:

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
- `message-processor` – Transform messages before or after they are sent to a provider.
- `renderer` – Customize how content is displayed in the chat transcript.
- `tool` – Provide callable utilities that models can invoke.
- `storage` – Implement alternative persistence layers for sessions and metadata.
- `ui-extension` – Mount additional UI panels or controls.

See `src/plugins/examples/` for more examples.

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
