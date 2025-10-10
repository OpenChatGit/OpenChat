// OpenAI provider implementation
import { BaseProvider } from '../base'
import type { ChatCompletionRequest, ChatCompletionResponse, ModelInfo, StreamResponse } from '../../types'

export class OpenAIProvider extends BaseProvider {
  private buildHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`
    }

    return headers
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/models`,
        {
          method: 'GET',
          headers: this.buildHeaders(),
        },
        10000
      )

      if (!response.ok) {
        // If API call fails, return known models
        return this.getKnownModels()
      }

      const data = await response.json()
      
      // Filter for chat models only
      const chatModels = (data.data || [])
        .filter((model: any) => 
          model.id.includes('gpt') || 
          model.id.includes('o1') ||
          model.id.includes('o3')
        )
        .map((model: any) => ({
          name: model.id,
          details: {
            created: model.created,
            owned_by: model.owned_by,
          }
        }))
        .sort((a: ModelInfo, b: ModelInfo) => b.name.localeCompare(a.name))

      return chatModels.length > 0 ? chatModels : this.getKnownModels()
    } catch (error) {
      console.error('OpenAI listModels error:', error)
      return this.getKnownModels()
    }
  }

  private getKnownModels(): ModelInfo[] {
    return [
      {
        name: 'gpt-4o',
        details: { 
          description: 'Most advanced multimodal model',
          context_window: 128000,
          max_output: 16384
        }
      },
      {
        name: 'gpt-4o-mini',
        details: { 
          description: 'Affordable and intelligent small model',
          context_window: 128000,
          max_output: 16384
        }
      },
      {
        name: 'o1',
        details: { 
          description: 'Reasoning model for complex tasks',
          context_window: 200000,
          max_output: 100000
        }
      },
      {
        name: 'o1-mini',
        details: { 
          description: 'Faster reasoning model',
          context_window: 128000,
          max_output: 65536
        }
      },
      {
        name: 'gpt-4-turbo',
        details: { 
          description: 'Previous generation flagship model',
          context_window: 128000,
          max_output: 4096
        }
      },
      {
        name: 'gpt-4',
        details: { 
          description: 'GPT-4 base model',
          context_window: 8192,
          max_output: 8192
        }
      },
      {
        name: 'gpt-3.5-turbo',
        details: { 
          description: 'Fast and efficient model',
          context_window: 16385,
          max_output: 4096
        }
      },
    ]
  }

  async sendMessage(
    request: ChatCompletionRequest,
    onChunk?: (content: string) => void
  ): Promise<string> {
    const url = `${this.config.baseUrl}/chat/completions`
    
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
          headers: this.buildHeaders(),
          body: JSON.stringify(body),
        },
        60000
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenAI request failed: ${response.statusText} - ${errorText}`)
      }

      const data: ChatCompletionResponse = await response.json()
      return data.choices[0]?.message?.content || ''
    }

    // Streaming request
    const response = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI request failed: ${response.statusText} - ${errorText}`)
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
              console.warn('Failed to parse OpenAI chunk:', data)
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
      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/models`,
        {
          method: 'GET',
          headers: this.buildHeaders(),
        },
        10000
      )
      return response.ok
    } catch (error) {
      return false
    }
  }
}
