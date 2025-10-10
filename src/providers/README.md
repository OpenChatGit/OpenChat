# OpenChat Providers

Modular provider system for connecting to different LLM backends.

## 📁 Directory Structure

```
src/providers/
├── ollama/              # Ollama provider
│   ├── index.ts
│   └── README.md
├── lmstudio/           # LM Studio provider
│   ├── index.ts
│   └── README.md
├── llamacpp/           # llama.cpp provider
│   ├── index.ts
│   └── README.md
├── anthropic/          # Anthropic Claude provider
│   ├── index.ts
│   └── README.md
├── openai/             # OpenAI GPT provider
│   ├── index.ts
│   └── README.md
├── base.ts             # Base provider class
├── factory.ts          # Provider factory
└── index.ts            # Main exports
```

## 🚀 Available Providers

### Local Providers

#### Ollama
**Default**: `http://localhost:11434`  
Local LLM runtime with easy model management.

[Documentation](./ollama/README.md)

#### LM Studio
**Default**: `http://localhost:1234`  
Desktop application for running quantized models.

[Documentation](./lmstudio/README.md)

#### llama.cpp
**Default**: `http://localhost:8080`  
High-performance inference server for GGUF models.

[Documentation](./llamacpp/README.md)

### Cloud Providers

#### Anthropic
**Default**: `https://api.anthropic.com`  
Claude models with advanced reasoning capabilities. **Requires API Key**.

[Documentation](./anthropic/README.md)

#### OpenAI
**Default**: `https://api.openai.com/v1`  
GPT models including GPT-4o and o1. **Requires API Key**.

[Documentation](./openai/README.md)

## 🔧 Adding a New Provider

### 1. Create Provider Directory

```
src/providers/your-provider/
├── index.ts       # Provider implementation
└── README.md      # Documentation
```

### 2. Implement Provider Class

```typescript
// src/providers/your-provider/index.ts
import { BaseProvider } from '../base'
import type { ChatCompletionRequest, ModelInfo } from '../../types'

export class YourProvider extends BaseProvider {
  async listModels(): Promise<ModelInfo[]> {
    // Implement model listing
  }

  async sendMessage(
    request: ChatCompletionRequest,
    onChunk?: (content: string) => void
  ): Promise<string> {
    // Implement message sending
  }

  async testConnection(): Promise<boolean> {
    // Implement connection test
  }
}
```

### 3. Register in Factory

```typescript
// src/providers/factory.ts
import { YourProvider } from './your-provider'

export class ProviderFactory {
  static createProvider(config: ProviderConfig): BaseProvider {
    switch (config.type) {
      // ... existing cases
      case 'your-provider':
        return new YourProvider(config)
      default:
        throw new Error(`Unsupported provider type: ${config.type}`)
    }
  }
}
```

### 4. Add Type Definition

```typescript
// src/types/index.ts
export type ProviderType = 
  | 'ollama' 
  | 'lmstudio' 
  | 'llamacpp'
  | 'your-provider' // Add here
```

### 5. Add Default Config

```typescript
// src/providers/factory.ts
static getDefaultConfig(type: ProviderType): ProviderConfig {
  const defaults: Record<ProviderType, ProviderConfig> = {
    // ... existing configs
    'your-provider': {
      type: 'your-provider',
      name: 'Your Provider',
      baseUrl: 'http://localhost:PORT',
      enabled: true,
    },
  }
  return defaults[type]
}
```

## 📚 Base Provider Class

All providers extend `BaseProvider` which provides:

- **fetchWithTimeout**: HTTP requests with timeout
- **config**: Provider configuration
- **Abstract methods**: `listModels()`, `sendMessage()`, `testConnection()`

## 🎯 Best Practices

### ✅ DO
- Extend `BaseProvider`
- Implement all abstract methods
- Handle errors gracefully
- Support streaming when possible
- Test connection before use
- Document your provider

### ❌ DON'T
- Hardcode URLs or ports
- Ignore timeout settings
- Skip error handling
- Break the interface contract

## 🔍 Provider Interface

```typescript
interface Provider {
  // List available models
  listModels(): Promise<ModelInfo[]>
  
  // Send message (streaming or non-streaming)
  sendMessage(
    request: ChatCompletionRequest,
    onChunk?: (content: string) => void
  ): Promise<string>
  
  // Test if provider is reachable
  testConnection(): Promise<boolean>
}
```

## 📖 Examples

Check existing providers for reference:
- **Simple**: `ollama/` - Custom API format
- **OpenAI-compatible**: `lmstudio/`, `llamacpp/` - Standard format
- **Streaming**: All providers support streaming

## 🤝 Contributing

1. Create your provider directory
2. Implement the provider class
3. Add documentation
4. Test thoroughly
5. Submit a Pull Request

---

**Happy Provider Development! 🚀**
