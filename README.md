![OpenChat screenshot](https://i.imgur.com/5h9F6rg.png)

# OpenChat

![Version](https://img.shields.io/badge/version-0.5.1-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![Free Forever](https://img.shields.io/badge/free-forever-brightgreen)

OpenChat is a modular, cross-platform LLM chat application built with Tauri, React, and TypeScript. It delivers a ChatGPT-style interface that connects seamlessly to local AI providers such as Ollama, LM Studio, and llama.cpp.

> 💚 **Free Forever Promise:** OpenChat will always remain 100% free and open source. No paid features, no subscriptions, no paywalls - ever. All features are custom-built and freely available to everyone. We accept donations to support development, but every feature will always be accessible to all users at no cost.

> ⚖️ **Copyright Notice:** This project is protected under German copyright law (Urheberrecht). While OpenChat is free and open source under the MIT License, all rights to the original work remain with the author. The MIT License grants you permission to use, modify, and distribute this software, but does not transfer copyright ownership.

> ⚠️ **Notice:** Experimental features have been integrated into the main branch as best as possible. Some features may still be in development or require additional testing. Please report any issues you encounter.

## Table of Contents

- [Features](#features)
- [What's New](#whats-new)
- [Supported Providers](#supported-providers)
- [Getting Started](#getting-started)
- [Vision Support](#vision-support)
- [Custom AI Personas](#custom-ai-personas)
- [Web Search System](#web-search-system)
- [Adding a New Provider](#adding-a-new-provider)
- [Creating Custom Plugins](#creating-custom-plugins)
- [Configuration](#configuration)
- [Development](#development)
- [Tech Stack](#tech-stack)
- [License](#license)
- [Recommended IDE Setup](#recommended-ide-setup)

## What's New

### Version 0.5.1 - Source Citation Support 🎯

OpenChat now includes intelligent source citations for web search results! When the AI uses web search to answer your questions, responses include inline citations `[1]`, `[2]` that reference the sources used.

**Key Features:**
- **Inline Citations** – Citations appear naturally in the text as `[1]`, `[2]` without disrupting reading flow
- **Interactive Source Favicons** – Click favicons in the "Searched Web" indicator to highlight related citations
- **Automatic Source Tracking** – All web search sources are tracked and linked to their citations
- **Full Markdown Support** – Citations work seamlessly with tables, lists, code blocks, and all markdown formatting

See the full [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

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
- **Vision support** – Send images to vision-capable models (GPT-4o, Claude 3.5 Sonnet, Llama 3.2 Vision, etc.) with automatic model detection, drag-and-drop support, and intelligent image processing.
- **Token usage tracking** – View detailed token consumption (input/output/total) for every AI response with provider-specific tokenization.
- **Free web search with citations** – Completely rebuilt web search system that's 100% free, with no API keys required. Features intelligent auto-detection, backend scraping, inline source citations, and a streamlined UI with real-time search indicators.
- **Custom AI Personas** – Define custom system prompts per chat session to change how the AI responds. Choose from quick presets (Coding Assistant, Technical Writer, Creative Partner, Friendly Tutor) or create your own persona with specific tone, expertise level, and response style.

## Supported Providers

| Provider | Default endpoint | Vision Support | Notes |
| --- | --- | --- | --- |
| **Ollama** | `http://localhost:11434` | ✅ Yes | Local LLM runtime and default backend. Supports vision models like Llama 3.2 Vision, LLaVA, and Bakllava. |
| **LM Studio** | `http://localhost:1234` | ✅ Yes | Desktop application for running quantized models. |
| **llama.cpp** | `http://localhost:8080` | ✅ Yes | High-performance inference server for GGUF models. |
| **OpenAI** | `https://api.openai.com/v1` | ✅ Yes | Cloud API with GPT-4o, GPT-4o-mini, and other vision-capable models. |
| **Anthropic** | `https://api.anthropic.com` | ✅ Yes | Cloud API with Claude 3.5 Sonnet, Claude 3 Opus, and other vision models. |

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

## Vision Support

OpenChat includes comprehensive support for vision-capable AI models, allowing you to send images alongside your text prompts for visual analysis, OCR, diagram interpretation, and more.

### Key Features

- **Automatic Model Detection** – Vision capability is automatically detected for each model based on provider and model name patterns.
- **Drag & Drop Support** – Simply drag images into the chat input or click to browse.
- **Multiple Image Formats** – Supports JPEG, PNG, GIF, and WebP with automatic format conversion.
- **Smart Image Processing** – Automatic resizing and compression to meet provider limits while maintaining quality.
- **Provider-Specific Optimization** – Respects size limits for each provider (OpenAI: 20MB, Anthropic: 5MB, Ollama: 100MB).
- **Image Preview** – View attached images before sending with thumbnail previews and lightbox support.
- **Intelligent Conflict Resolution** – Automatically disables web search when images are attached to prevent conflicts.

### Supported Vision Models

**OpenAI:**
- GPT-4o, GPT-4o-mini
- GPT-4-turbo, GPT-4-vision

**Anthropic:**
- Claude 3.5 Sonnet, Claude 3.5 Haiku
- Claude 3 Opus, Claude 3 Sonnet, Claude 3 Haiku

**Ollama (Local):**
- Llama 3.2 Vision (11B, 90B)
- LLaVA (7B, 13B, 34B)
- Bakllava
- Any other vision-capable model

### Usage

1. Select a vision-capable model from the model dropdown (indicated by a 👁️ icon)
2. Drag and drop an image into the chat input, or click the image button to browse
3. Add your text prompt describing what you want to know about the image
4. Send the message - the image will be processed and sent to the model

The system automatically handles image encoding, resizing, and format conversion based on the selected provider's requirements.

## Custom AI Personas

OpenChat allows you to define custom AI personas for each chat session, giving you fine-grained control over how the AI responds to your prompts. This feature enables you to tailor the AI's behavior, tone, and expertise to match your specific needs.

### Key Features

- **Session-Specific Personas** – Each chat can have its own unique persona that persists across the conversation.
- **Quick Presets** – Choose from built-in persona templates:
  - **Coding Assistant** – Expert software engineer providing clear code solutions with best practices
  - **Technical Writer** – Documentation expert creating clear, well-structured explanations
  - **Creative Partner** – Brainstorming partner generating innovative ideas
  - **Friendly Tutor** – Patient educator breaking down complex topics
- **Custom Personas** – Write your own persona prompts to define specific behaviors, expertise levels, and response styles.
- **Visual Indicators** – Clear UI feedback showing when a persona is active with a floating button and status indicators.
- **Easy Toggle** – Enable or disable personas on the fly without losing your custom prompt.

### How It Works

The persona system combines your custom persona prompt with the global system prompt, allowing you to layer specific instructions on top of the base AI behavior. This gives you the flexibility to:

- Set the AI's expertise level and domain knowledge
- Define the tone and communication style (formal, casual, technical, creative)
- Specify response formats (concise, detailed, step-by-step)
- Establish role-playing scenarios or specific contexts

### Usage

1. Click the **Persona button** (user icon) in the top-right corner of the chat area
2. Choose a **quick preset** or write your own custom persona prompt
3. **Enable the toggle** to activate the persona for the current chat
4. The persona will be applied to all subsequent messages in that session

The persona prompt is stored with the chat session, so you can return to conversations and continue with the same AI personality.

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
