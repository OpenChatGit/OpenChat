# OpenAI Provider

Provider implementation for OpenAI's GPT models.

## Features

- **Streaming Support**: Real-time response streaming
- **Multiple Models**: Support for GPT-4o, o1, GPT-4, and GPT-3.5
- **Dynamic Model Discovery**: Fetches available models from API
- **Fallback Models**: Known models list if API is unavailable
- **Error Handling**: Comprehensive error messages

## Configuration

```typescript
{
  type: 'openai',
  name: 'OpenAI',
  baseUrl: 'https://api.openai.com/v1',
  enabled: false,
  apiKey: 'your-api-key-here'
}
```

## Supported Models

The provider dynamically fetches available models, but includes these known models as fallback:

- `gpt-4o` - Most advanced multimodal model (128K context)
- `gpt-4o-mini` - Affordable and intelligent small model (128K context)
- `o1` - Reasoning model for complex tasks (200K context)
- `o1-mini` - Faster reasoning model (128K context)
- `gpt-4-turbo` - Previous generation flagship (128K context)
- `gpt-4` - GPT-4 base model (8K context)
- `gpt-3.5-turbo` - Fast and efficient (16K context)

## API Key

Required. Get your API key from: https://platform.openai.com/api-keys

## Notes

- Model list is cached for 5 minutes to improve performance
- Filters for chat models only (excludes embedding, audio, etc.)
- Compatible with OpenAI-compatible APIs (change baseUrl)
