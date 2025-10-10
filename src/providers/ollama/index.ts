// Ollama provider implementation
import { BaseProvider } from '../base'
import type { ChatCompletionRequest, ModelInfo } from '../../types'

export class OllamaProvider extends BaseProvider {
  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/api/tags`,
        { method: 'GET' },
        8000 // 8s timeout for model listing
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
    onChunk?: (content: string) => void
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
      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.statusText}`)
      }

      const data = await response.json()
      return data.message?.content || ''
    }

    // Streaming request
    console.log('[Ollama] Starting streaming request to:', url)
    console.log('[Ollama] Request body:', JSON.stringify(body, null, 2))
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    console.log('[Ollama] Response status:', response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Ollama] Error response:', errorText)
      throw new Error(`Ollama request failed: ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let fullContent = ''
    let chunkCount = 0

    try {
      console.log('[Ollama] Starting to read stream...')
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          console.log('[Ollama] Stream complete. Total chunks:', chunkCount, 'Total content length:', fullContent.length)
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(line => line.trim())

        for (const line of lines) {
          try {
            const json = JSON.parse(line)
            if (json.message?.content) {
              const content = json.message.content
              fullContent += content
              chunkCount++
              if (chunkCount <= 3) {
                console.log('[Ollama] Chunk', chunkCount, ':', content.slice(0, 50))
              }
              onChunk(content)
            }
            if (json.done) {
              console.log('[Ollama] Received done signal')
              return fullContent
            }
          } catch (e) {
            console.warn('[Ollama] Failed to parse chunk:', line)
          }
        }
      }
    } catch (error) {
      console.error('[Ollama] Stream reading error:', error)
      throw error
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
