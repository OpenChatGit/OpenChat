// OpenAI provider implementation
import { BaseProvider } from './base'
import type { ChatCompletionRequest, ModelInfo } from '../types'

export class OpenAIProvider extends BaseProvider {
  async listModels(): Promise<ModelInfo[]> {
    try {
      if (!this.config.apiKey) {
        console.warn('OpenAI API key not configured')
        return []
      }

      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/models`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Filter for chat models only (exclude embeddings, audio, moderation, etc.)
      const chatModels = (data.data || [])
        .filter((model: any) => {
          const modelId = model.id.toLowerCase()
          
          // Exclude non-chat models
          if (modelId.includes('embedding')) return false
          if (modelId.includes('whisper')) return false
          if (modelId.includes('tts')) return false
          if (modelId.includes('dall-e')) return false
          if (modelId.includes('moderation')) return false
          if (modelId.includes('search')) return false
          if (modelId.includes('audio') && !modelId.includes('preview')) return false
          if (modelId.includes('babbage')) return false
          if (modelId.includes('davinci')) return false
          if (modelId.includes('curie')) return false
          if (modelId.includes('ada')) return false
          
          // Exclude models with date stamps (e.g., gpt-4-0613, gpt-3.5-turbo-0125)
          // Pattern: -MMDD or -YYMM or -YYYYMMDD
          if (/-(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])/.test(modelId)) return false  // -MMDD
          if (/-(19|20)\d{2}-(0[1-9]|1[0-2])/.test(modelId)) return false  // -YYYY-MM
          if (/-\d{4}(-\d{2})?(-\d{2})?$/.test(modelId)) return false  // -YYMM or -YYYYMMDD at end
          
          // Include GPT and O-series chat models
          if (modelId.startsWith('gpt-')) return true
          if (modelId.startsWith('o1')) return true
          if (modelId.startsWith('o3')) return true
          if (modelId.startsWith('chatgpt')) return true
          
          return false
        })
        .map((model: any) => ({
          name: model.id,
          size: undefined,
          modified: undefined,
          digest: undefined,
          details: {
            owned_by: model.owned_by,
            created: model.created,
          },
        }))
        .filter((model: any) => {
          // Filter out models that user has hidden
          const hiddenModels = this.config.hiddenModels || []
          return !hiddenModels.includes(model.name)
        })
        .sort((a: any, b: any) => {
          // Sort by quality: Best models first (top), weaker models last (bottom)
          const modelA = a.name.toLowerCase()
          const modelB = b.name.toLowerCase()
          
          // Define priority based on release date and capabilities
          // Lower number = newer/better = higher in list
          const getPriority = (name: string): number => {
            // January 2025 - Newest
            if (name === 'o3-mini') return 1
            
            // December 2024
            if (name === 'o1') return 2
            
            // September 2024
            if (name === 'o1-preview') return 3
            if (name === 'o1-mini') return 4
            
            // Dynamic (always latest 4o)
            if (name === 'chatgpt-4o-latest') return 5
            
            // July 2024
            if (name === 'gpt-4o-mini') return 6
            
            // May 2024
            if (name === 'gpt-4o') return 7
            if (name === 'gpt-4o-realtime-preview') return 8
            if (name === 'gpt-4o-audio-preview') return 9
            
            // April 2024
            if (name === 'gpt-4-turbo') return 10
            if (name === 'gpt-4-turbo-preview') return 11
            
            // March 2023
            if (name === 'gpt-4') return 20
            
            // March 2022 - Oldest
            if (name === 'gpt-3.5-turbo') return 30
            if (name.startsWith('gpt-3.5')) return 31
            
            // Unknown models go to the end
            return 999
          }
          
          const aPriority = getPriority(modelA)
          const bPriority = getPriority(modelB)
          
          // If same priority, sort alphabetically
          if (aPriority === bPriority) {
            return modelA.localeCompare(modelB)
          }
          
          return aPriority - bPriority
        })

      return chatModels
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (!errorMessage.includes('Failed to fetch') && !errorMessage.includes('ERR_CONNECTION_REFUSED')) {
        console.warn('OpenAI listModels error:', error)
      }
      return []
    }
  }

  async sendMessage(
    request: ChatCompletionRequest,
    onChunk?: (content: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const url = `${this.config.baseUrl}/chat/completions`
    
    const body = {
      model: request.model,
      messages: request.messages,
      stream: !!onChunk,
      temperature: request.temperature,
      max_tokens: request.max_tokens,
      top_p: request.top_p,
      frequency_penalty: request.frequency_penalty,
      presence_penalty: request.presence_penalty,
    }

    const headers = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
    }

    if (!onChunk) {
      // Non-streaming request
      const response = await this.fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        },
        60000,
        signal
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `OpenAI request failed: ${response.statusText}${
            errorData.error?.message ? ` - ${errorData.error.message}` : ''
          }`
        )
      }

      const data = await response.json()
      const choice = data.choices?.[0]
      if (!choice) {
        throw new Error('No response from OpenAI')
      }

      const reasoning = choice.message?.reasoning_content || ''
      const content = choice.message?.content || ''
      
      return reasoning ? `<think>${reasoning}</think>${content}` : content
    }

    // Streaming request
    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      },
      60000,
      signal
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        `OpenAI request failed: ${response.statusText}${
          errorData.error?.message ? ` - ${errorData.error.message}` : ''
        }`
      )
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
        const lines = chunk
          .split('\n')
          .filter(line => line.trim() && line.trim() !== 'data: [DONE]')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue

          try {
            const json = JSON.parse(line.slice(6))
            const delta = json.choices?.[0]?.delta

            if (!delta) continue

            const reasoning = delta.reasoning_content
            const content = delta.content

            if (reasoning) {
              if (!reasoningOpen) {
                reasoningOpen = true
                fullContent += '<think>'
                onChunk('<think>')
              }
              fullContent += reasoning
              onChunk(reasoning)
            }

            if (content) {
              if (reasoningOpen) {
                reasoningOpen = false
                fullContent += '</think>'
                onChunk('</think>')
              }
              fullContent += content
              onChunk(content)
            }

            if (json.choices?.[0]?.finish_reason) {
              if (reasoningOpen) {
                reasoningOpen = false
                fullContent += '</think>'
                onChunk('</think>')
              }
              return fullContent
            }
          } catch (e) {
            console.warn('Failed to parse SSE chunk:', line)
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

  async testConnection(timeout = 5000): Promise<boolean> {
    try {
      if (!this.config.apiKey) {
        return false
      }

      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/models`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
        },
        timeout
      )
      
      return response.ok
    } catch (error) {
      return false
    }
  }
}
