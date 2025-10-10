// Anthropic provider implementation
import { BaseProvider } from '../base'
import type { ChatCompletionRequest, ModelInfo } from '../../types'

export class AnthropicProvider extends BaseProvider {
  private buildHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    }

    if (this.config.apiKey) {
      headers['x-api-key'] = this.config.apiKey
    }

    return headers
  }

  async listModels(): Promise<ModelInfo[]> {
    // Anthropic doesn't have a public models endpoint
    // Return the known available models
    return [
      {
        name: 'claude-3-5-sonnet-20241022',
        details: { 
          description: 'Most intelligent model',
          context_window: 200000,
          max_output: 8192
        }
      },
      {
        name: 'claude-3-5-haiku-20241022',
        details: { 
          description: 'Fastest model',
          context_window: 200000,
          max_output: 8192
        }
      },
      {
        name: 'claude-3-opus-20240229',
        details: { 
          description: 'Powerful model for highly complex tasks',
          context_window: 200000,
          max_output: 4096
        }
      },
      {
        name: 'claude-3-sonnet-20240229',
        details: { 
          description: 'Balance of intelligence and speed',
          context_window: 200000,
          max_output: 4096
        }
      },
      {
        name: 'claude-3-haiku-20240307',
        details: { 
          description: 'Fast and compact model',
          context_window: 200000,
          max_output: 4096
        }
      },
    ]
  }

  async sendMessage(
    request: ChatCompletionRequest,
    onChunk?: (content: string) => void
  ): Promise<string> {
    const url = `${this.config.baseUrl}/v1/messages`
    
    // Convert messages to Anthropic format
    const systemMessages = request.messages.filter(m => m.role === 'system')
    const conversationMessages = request.messages.filter(m => m.role !== 'system')
    
    const body = {
      model: request.model,
      messages: conversationMessages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      })),
      max_tokens: request.max_tokens || 4096,
      temperature: request.temperature,
      top_p: request.top_p,
      stream: !!onChunk,
      ...(systemMessages.length > 0 && { 
        system: systemMessages.map(m => m.content).join('\n') 
      })
    }

    if (!onChunk) {
      // Non-streaming request
      const response = await this.fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: this.buildHeaders(),
          body: JSON.stringify(body),
        },
        60000 // 60s timeout for Anthropic
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Anthropic request failed: ${response.statusText} - ${errorText}`)
      }

      const data = await response.json()
      return data.content?.[0]?.text || ''
    }

    // Streaming request
    const response = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Anthropic request failed: ${response.statusText} - ${errorText}`)
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
            
            try {
              const json = JSON.parse(data)
              
              if (json.type === 'content_block_delta') {
                const content = json.delta?.text
                if (content) {
                  fullContent += content
                  onChunk(content)
                }
              } else if (json.type === 'message_stop') {
                return fullContent
              }
            } catch (e) {
              console.warn('Failed to parse Anthropic chunk:', data)
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
    if (!this.config.apiKey) {
      return false
    }

    try {
      // Test with a minimal request
      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/v1/messages`,
        {
          method: 'POST',
          headers: this.buildHeaders(),
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 1
          }),
        },
        10000
      )
      return response.ok || response.status === 400 // 400 might mean API key is valid but request format issue
    } catch (error) {
      return false
    }
  }
}
