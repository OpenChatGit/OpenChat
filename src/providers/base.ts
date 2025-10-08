// Base provider interface - all providers must implement this
import type { ChatCompletionRequest, ModelInfo, ProviderConfig } from '../types'

export abstract class BaseProvider {
  protected config: ProviderConfig

  constructor(config: ProviderConfig) {
    this.config = config
  }

  abstract listModels(): Promise<ModelInfo[]>
  
  abstract sendMessage(
    request: ChatCompletionRequest,
    onChunk?: (content: string) => void
  ): Promise<string>

  abstract testConnection(): Promise<boolean>

  getConfig(): ProviderConfig {
    return this.config
  }

  updateConfig(config: Partial<ProviderConfig>): void {
    this.config = { ...this.config, ...config }
  }

  protected async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout = 30000
  ): Promise<Response> {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })
      clearTimeout(id)
      return response
    } catch (error) {
      clearTimeout(id)
      throw error
    }
  }
}
