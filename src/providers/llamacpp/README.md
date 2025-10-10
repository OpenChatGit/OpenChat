# llama.cpp Provider

Provider implementation for [llama.cpp](https://github.com/ggerganov/llama.cpp) - high-performance inference server for GGUF models.

## Features

- ✅ Streaming responses
- ✅ Connection testing
- ✅ OpenAI-compatible API
- ✅ High performance

## Default Configuration

- **Base URL**: `http://localhost:8080`
- **API Endpoint**: `/v1/chat/completions`

## Usage

```bash
# Start llama.cpp server
./server -m models/your-model.gguf --port 8080
```

## Supported Features

- OpenAI-compatible API
- Streaming responses
- High-performance inference
- GGUF model support
- Temperature and sampling controls

## Note

llama.cpp doesn't provide a model listing endpoint, so a default model entry is shown.
