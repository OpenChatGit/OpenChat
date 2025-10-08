// Provider factory - creates provider instances based on type
import type { ProviderConfig, ProviderType } from '../types'
import { BaseProvider } from './base'
import { OllamaProvider } from './ollama'
import { LMStudioProvider } from './lmstudio'
import { LlamaCppProvider } from './llamacpp'

export class ProviderFactory {
  static createProvider(config: ProviderConfig): BaseProvider {
    switch (config.type) {
      case 'ollama':
        return new OllamaProvider(config)
      case 'lmstudio':
        return new LMStudioProvider(config)
      case 'llamacpp':
        return new LlamaCppProvider(config)
      default:
        throw new Error(`Unsupported provider type: ${config.type}`)
    }
  }

  static getDefaultConfig(type: ProviderType): ProviderConfig {
    const defaults: Record<ProviderType, ProviderConfig> = {
      ollama: {
        type: 'ollama',
        name: 'Ollama',
        baseUrl: 'http://localhost:11434',
        enabled: true,
      },
      lmstudio: {
        type: 'lmstudio',
        name: 'LM Studio',
        baseUrl: 'http://localhost:1234',
        enabled: true,
      },
      llamacpp: {
        type: 'llamacpp',
        name: 'llama.cpp',
        baseUrl: 'http://localhost:8080',
        enabled: true,
      },
      koboldcpp: {
        type: 'koboldcpp',
        name: 'KoboldCpp',
        baseUrl: 'http://localhost:5001',
        enabled: true,
      },
      'textgen-webui': {
        type: 'textgen-webui',
        name: 'Text Generation WebUI',
        baseUrl: 'http://localhost:5000',
        enabled: true,
      },
      anthropic: {
        type: 'anthropic',
        name: 'Anthropic',
        baseUrl: 'https://api.anthropic.com',
        enabled: false,
      },
      openai: {
        type: 'openai',
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        enabled: false,
      },
    }

    return defaults[type]
  }
}
