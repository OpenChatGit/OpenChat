// LM Studio provider implementation (OpenAI-compatible API)
import { BaseProvider } from './base'
import type { ChatCompletionRequest, ChatCompletionResponse, ModelInfo, StreamResponse } from '../types'

export class LMStudioProvider extends BaseProvider {
  private buildHeaders(includeJson = false): HeadersInit {
    const headers: HeadersInit = {}

    if (includeJson) {
      headers['Content-Type'] = 'application/json'
    }

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`
    }

    return headers
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/v1/models`,
        {
          method: 'GET',
          headers: this.buildHeaders(),
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`)
      }

      const data = await response.json()
      return (data.data || []).map((model: any) => ({
        name: model.id,
        size: model.size,
        details: model,
      }))
    } catch (error) {
      // Silently handle connection errors - provider is likely not running
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (!errorMessage.includes('Failed to fetch') && !errorMessage.includes('ERR_CONNECTION_REFUSED')) {
        console.warn('LM Studio listModels error:', error)
      }
      return []
    }
  }

  async sendMessage(
    request: ChatCompletionRequest,
    onChunk?: (content: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const url = `${this.config.baseUrl}/v1/chat/completions`
    
    const body: ChatCompletionRequest = {
      model: request.model,
      messages: request.messages,
      stream: !!onChunk,
      temperature: request.temperature,
      max_tokens: request.max_tokens,
      top_p: request.top_p,
      frequency_penalty: request.frequency_penalty,
      presence_penalty: request.presence_penalty,
    }

    if (!onChunk) {
      // Non-streaming request
      const response = await this.fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: this.buildHeaders(true),
          body: JSON.stringify(body),
        },
        30000,
        signal
      )

      if (!response.ok) {
        throw new Error(`LM Studio request failed: ${response.statusText}`)
      }

      const data: ChatCompletionResponse = await response.json()
      const msg = data.choices[0]?.message
      if (!msg) return ''
      const reasoning = msg.reasoning_content?.trim()
      const text = msg.content || ''
      return reasoning ? `<think>${reasoning}</think>${text}` : text
    }

    // Streaming request
    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: this.buildHeaders(true),
        body: JSON.stringify(body),
      },
      30000,
      signal
    )

    if (!response.ok) {
      throw new Error(`LM Studio request failed: ${response.statusText}`)
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
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              return fullContent
            }

            try {
              const json: StreamResponse = JSON.parse(data)
              const delta = json.choices[0]?.delta || {}
              const r = (delta as any).reasoning_content as string | undefined
              const c = delta.content as string | undefined

              if (r) {
                if (!reasoningOpen) {
                  reasoningOpen = true
                  fullContent += '<think>'
                  onChunk('<think>')
                }
                fullContent += r
                onChunk(r)
              }

              if (c) {
                if (reasoningOpen) {
                  reasoningOpen = false
                  fullContent += '</think>'
                  onChunk('</think>')
                }
                fullContent += c
                onChunk(c)
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

    if (reasoningOpen) {
      fullContent += '</think>'
      onChunk('</think>')
    }
    return fullContent
  }

  async testConnection(timeout = 2000): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/v1/models`,
        {
          method: 'GET',
          headers: this.buildHeaders(),
        },
        timeout
      )
      return response.ok
    } catch (error) {
      return false
    }
  }
}
