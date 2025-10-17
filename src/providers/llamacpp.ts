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
        throw new Error(`llama.cpp request failed: ${response.statusText}`)
      }

      const data: ChatCompletionResponse = await response.json()
      const msg = data.choices[0]?.message
      if (!msg) return ''
      const reasoning = (msg as any).reasoning_content?.trim()
      const text = msg.content || ''
      return reasoning ? `<think>${reasoning}</think>${text}` : text
    }

    // Streaming request (OpenAI-compatible format)
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
      throw new Error(`llama.cpp request failed: ${response.statusText}`)
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
              const c = (delta as any).content as string | undefined

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
      reasoningOpen = false
      fullContent += '</think>'
      onChunk && onChunk('</think>')
    }
    return fullContent
  }

  async testConnection(timeout = 2000): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/health`,
        { method: 'GET' },
        timeout
      )
      return response.ok
    } catch (error) {
      // Try alternative endpoint
      try {
        const response = await this.fetchWithTimeout(
          `${this.config.baseUrl}/v1/models`,
          { method: 'GET' },
          timeout
        )
        return response.ok
      } catch {
        return false
      }
    }
  }
}
