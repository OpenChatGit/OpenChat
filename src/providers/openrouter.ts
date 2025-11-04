import { BaseProvider } from './base'
import type { ChatCompletionRequest, ModelInfo } from '../types'
import { createModelCapabilities } from '../lib/visionDetection'

export class OpenRouterProvider extends BaseProvider {
  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/v1/models`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'HTTP-Referer': 'https://github.com/yourusername/openchat', // Required by OpenRouter
          'X-Title': 'OpenChat' // Optional: Shows in OpenRouter dashboard
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`)
      }

      const data = await response.json()
      
      // OpenRouter returns models in data array
      return data.data.map((model: any) => ({
        name: model.id,
        size: model.context_length ? `${model.context_length} tokens` : undefined,
        details: {
          description: model.description,
          pricing: model.pricing,
          context_length: model.context_length,
          architecture: model.architecture
        },
        capabilities: createModelCapabilities(model.id, 'openrouter')
      }))
        .filter((model: any) => {
          // Filter out models that user has hidden
          const hiddenModels = this.config.hiddenModels || []
          return !hiddenModels.includes(model.name)
        })
    } catch (error) {
      console.error('OpenRouter listModels error:', error)
      throw error
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/v1/models`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'HTTP-Referer': 'https://github.com/yourusername/openchat',
          'X-Title': 'OpenChat'
        }
      })
      return response.ok
    } catch {
      return false
    }
  }

  async sendMessage(
    request: ChatCompletionRequest,
    onChunk?: (content: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('OpenRouter API key not configured')
    }

    const response = await fetch(`${this.config.baseUrl}/api/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        'HTTP-Referer': 'https://github.com/yourusername/openchat',
        'X-Title': 'OpenChat'
      },
      body: JSON.stringify({
        ...request,
        stream: !!onChunk
      }),
      signal
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenRouter API error: ${error}`)
    }

    // Streaming response
    if (onChunk && response.body) {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices[0]?.delta?.content || ''
              if (content) {
                fullContent += content
                onChunk(content)
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      return fullContent
    }

    // Non-streaming response
    const data = await response.json()
    return data.choices[0].message.content
  }
}
