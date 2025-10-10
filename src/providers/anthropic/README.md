# Anthropic Provider

Provider implementation for Anthropic's Claude models.

## Features

- **Streaming Support**: Real-time response streaming
- **Multiple Models**: Support for Claude 3.5 Sonnet, Haiku, Opus, and earlier versions
- **System Messages**: Proper handling of system prompts
- **Error Handling**: Comprehensive error messages

## Configuration

```typescript
{
  type: 'anthropic',
  name: 'Anthropic',
  baseUrl: 'https://api.anthropic.com',
  enabled: false,
  apiKey: 'your-api-key-here'
}
```

## Supported Models

- `claude-3-5-sonnet-20241022` - Most intelligent model (200K context)
- `claude-3-5-haiku-20241022` - Fastest model (200K context)
- `claude-3-opus-20240229` - Powerful for complex tasks (200K context)
- `claude-3-sonnet-20240229` - Balance of intelligence and speed (200K context)
- `claude-3-haiku-20240307` - Fast and compact (200K context)

## API Key

Required. Get your API key from: https://console.anthropic.com/

## Notes

- Anthropic API uses a different message format than OpenAI
- System messages are sent separately in the `system` field
- Default max_tokens is set to 4096 if not specified
