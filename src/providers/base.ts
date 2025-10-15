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
    onChunk?: (content: string) => void,
    signal?: AbortSignal
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
    timeout = 30000,
    externalSignal?: AbortSignal
  ): Promise<Response> {
    const controller = new AbortController()
    const hasTimeout = typeof timeout === 'number' && timeout > 0
    const id = hasTimeout ? setTimeout(() => controller.abort(), timeout) : undefined

    const cleanup = () => { if (id !== undefined) clearTimeout(id) }
    const onExternalAbort = () => controller.abort()

    if (externalSignal) {
      if (externalSignal.aborted) controller.abort()
      externalSignal.addEventListener('abort', onExternalAbort, { once: true })
    }

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })
      cleanup()
      return response
    } catch (error) {
      cleanup()
      throw error
    } finally {
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort as any)
      }
    }
  }
}
