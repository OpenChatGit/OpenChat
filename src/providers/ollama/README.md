# Ollama Provider

Provider implementation for [Ollama](https://ollama.ai/) - a local LLM runtime.

## Features

- ✅ Model listing
- ✅ Streaming responses
- ✅ Connection testing
- ✅ Full chat completion support

## Default Configuration

- **Base URL**: `http://localhost:11434`
- **API Endpoint**: `/api/chat`

## Usage

Ollama must be running locally. Install from [ollama.ai](https://ollama.ai/)

```bash
# Start Ollama
ollama serve

# Pull a model
ollama pull llama2
```

## Supported Features

- Streaming and non-streaming responses
- Temperature control
- Token limit configuration
- Top-p sampling
