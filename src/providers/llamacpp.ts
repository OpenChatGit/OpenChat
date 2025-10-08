// llama.cpp server provider implementation
import { BaseProvider } from './base'
import type { ChatCompletionRequest, ChatCompletionResponse, ModelInfo, StreamResponse } from '../types'

export class LlamaCppProvider extends BaseProvider {
  async listModels(): Promise<ModelInfo[]> {
    // llama.cpp doesn't have a models endpoint, return a default entry
    return [{
      name: 'llama.cpp-model',
      details: { info: 'Model loaded in llama.cpp server' }
    }]
  }

  async sendMessage(
    request: ChatCompletionRequest,
    onChunk?: (content: string) => void
  ): Promise<string> {
    const url = `${this.config.baseUrl}/v1/chat/completions`
    
    const body: ChatCompletionRequest = {
      model: request.model,
      messages: request.messages,
      stream: !!onChunk,
      temperature: request.temperature,
      max_tokens: request.max_tokens,
      top_p: request.top_p,
    }

    if (!onChunk) {
      // Non-streaming request
      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        throw new Error(`llama.cpp request failed: ${response.statusText}`)
      }

      const data: ChatCompletionResponse = await response.json()
      return data.choices[0]?.message?.content || ''
    }

    // Streaming request (OpenAI-compatible format)
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`llama.cpp request failed: ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let fullContent = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(line => line.trim())

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              return fullContent
            }

            try {
              const json: StreamResponse = JSON.parse(data)
              const content = json.choices[0]?.delta?.content
              if (content) {
                fullContent += content
                onChunk(content)
              }
            } catch (e) {
              console.warn('Failed to parse chunk:', data)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    return fullContent
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/health`,
        { method: 'GET' },
        5000
      )
      return response.ok
    } catch (error) {
      // Try alternative endpoint
      try {
        const response = await this.fetchWithTimeout(
          `${this.config.baseUrl}/v1/models`,
          { method: 'GET' },
          5000
        )
        return response.ok
      } catch {
        return false
      }
    }
  }
}
