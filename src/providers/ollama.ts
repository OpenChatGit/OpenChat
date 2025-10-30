// Ollama provider implementation
import { BaseProvider } from './base'
import type { ChatCompletionRequest, ModelInfo } from '../types'
import { createModelCapabilities } from '../lib/visionDetection'
import { debugReasoningResponse, logReasoningDebug, isReasoningDebugEnabled } from '../lib/reasoningDebug'

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
      
      // Add vision capabilities to models that support it
      const models = (data.models || []).map((model: any) => ({
        ...model,
        capabilities: createModelCapabilities(model.name, 'ollama'),
      }))
      
      return models
    } catch (error) {
      // Silently handle connection errors - provider is likely not running
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (!errorMessage.includes('Failed to fetch') && !errorMessage.includes('ERR_CONNECTION_REFUSED')) {
        console.warn('Ollama listModels error:', error)
      }
      return []
    }
  }

  async sendMessage(
    request: ChatCompletionRequest,
    onChunk?: (content: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const url = `${this.config.baseUrl}/api/chat`
    
    // Convert messages to Ollama format with images
    const formattedMessages = request.messages.map(msg => {
      // Check if message has images (from extended Message type)
      const messageWithImages = msg as any
      if (messageWithImages.images && messageWithImages.images.length > 0) {
        // Ollama expects images as an array of base64 strings
        const images = messageWithImages.images.map((img: any) => img.data)
        
        return {
          role: msg.role,
          content: msg.content,
          images
        }
      }
      
      // Regular text-only message
      return {
        role: msg.role,
        content: msg.content
      }
    })
    
    const body = {
      model: request.model,
      messages: formattedMessages,
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
      const result = reasoning ? `<think>${reasoning}</think>${text}` : text
      
      // Debug reasoning if enabled
      if (isReasoningDebugEnabled()) {
        const debugInfo = debugReasoningResponse(request.model, result, data)
        logReasoningDebug(debugInfo)
      }
      
      return result
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
              
              // Debug reasoning if enabled
              if (isReasoningDebugEnabled()) {
                const debugInfo = debugReasoningResponse(request.model, fullContent, json)
                logReasoningDebug(debugInfo)
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

  async testConnection(timeout = 2000): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/api/version`,
        { method: 'GET' },
        timeout
      )
      return response.ok
    } catch (error) {
      return false
    }
  }

  async deleteModel(modelName: string): Promise<void> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/api/delete`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: modelName }),
        },
        10000
      )

      if (!response.ok) {
        throw new Error(`Failed to delete model: ${response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to delete model:', error)
      throw error
    }
  }
}
