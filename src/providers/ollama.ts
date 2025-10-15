// Ollama provider implementation
import { BaseProvider } from './base'
import type { ChatCompletionRequest, ModelInfo } from '../types'

export class OllamaProvider extends BaseProvider {
  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/api/tags`,
        { method: 'GET' }
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`)
      }

      const data = await response.json()
      return data.models || []
    } catch (error) {
      console.error('Ollama listModels error:', error)
      return []
    }
  }

  async sendMessage(
    request: ChatCompletionRequest,
    onChunk?: (content: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const url = `${this.config.baseUrl}/api/chat`
    
    const body = {
      model: request.model,
      messages: request.messages,
      stream: !!onChunk,
      options: {
        temperature: request.temperature,
        top_p: request.top_p,
        num_predict: request.max_tokens,
      },
    }

    if (!onChunk) {
      // Non-streaming request
      const response = await this.fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        30000,
        signal
      )

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.statusText}`)
      }

      const data = await response.json()
      const msg = data.message || {}
      const reasoning = (msg.reasoning_content || msg.reasoning || msg.thoughts || msg.thinking || data.reasoning_content || data.reasoning || data.thoughts || data.thinking || '').toString().trim()
      const text = msg.content || data.response || ''
      return reasoning ? `<think>${reasoning}</think>${text}` : text
    }

    // Streaming request
    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      30000,
      signal
    )

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let fullContent = ''
    let reasoningOpen = false

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(line => line.trim())

        for (const line of lines) {
          try {
            const json = JSON.parse(line)
            const msg = json.message || {}
            const r = (msg.reasoning_content || msg.reasoning || msg.thoughts || msg.thinking || json.reasoning_content || json.reasoning || json.thoughts || json.thinking) as string | undefined
            const c = (msg.content || json.response) as string | undefined

            if (r) {
              if (!reasoningOpen) {
                reasoningOpen = true
                fullContent += '<think>'
                onChunk && onChunk('<think>')
              }
              fullContent += r
              onChunk && onChunk(r)
            }

            if (c) {
              if (reasoningOpen) {
                reasoningOpen = false
                fullContent += '</think>'
                onChunk && onChunk('</think>')
              }
              fullContent += c
              onChunk && onChunk(c)
            }

            if (json.done) {
              if (reasoningOpen) {
                reasoningOpen = false
                fullContent += '</think>'
                onChunk && onChunk('</think>')
              }
              return fullContent
            }
          } catch (e) {
            console.warn('Failed to parse chunk:', line)
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
        `${this.config.baseUrl}/api/tags`,
        { method: 'GET' },
        5000
      )
      return response.ok
    } catch (error) {
      return false
    }
  }
}
