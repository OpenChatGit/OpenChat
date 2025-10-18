// Anthropic provider implementation
import { BaseProvider } from './base'
import type { ChatCompletionRequest, ModelInfo } from '../types'

export class AnthropicProvider extends BaseProvider {
    async listModels(): Promise<ModelInfo[]> {
        // Anthropic doesn't have a public models endpoint
        // Return hardcoded list of available models
        const allModels = [
            {
                name: 'claude-3-5-sonnet-20241022',
                size: undefined,
                modified: undefined,
                digest: undefined,
                details: {
                    description: 'Most intelligent model (Latest)',
                    context_window: 200000,
                },
            },
            {
                name: 'claude-3-5-haiku-20241022',
                size: undefined,
                modified: undefined,
                digest: undefined,
                details: {
                    description: 'Fastest model',
                    context_window: 200000,
                },
            },
            {
                name: 'claude-3-opus-20240229',
                size: undefined,
                modified: undefined,
                digest: undefined,
                details: {
                    description: 'Most capable (Previous generation)',
                    context_window: 200000,
                },
            },
            {
                name: 'claude-3-sonnet-20240229',
                size: undefined,
                modified: undefined,
                digest: undefined,
                details: {
                    description: 'Balanced performance',
                    context_window: 200000,
                },
            },
            {
                name: 'claude-3-haiku-20240307',
                size: undefined,
                modified: undefined,
                digest: undefined,
                details: {
                    description: 'Fast and compact',
                    context_window: 200000,
                },
            },
        ]

        // Filter out hidden models
        const hiddenModels = this.config.hiddenModels || []
        return allModels.filter(model => !hiddenModels.includes(model.name))
    }

    async sendMessage(
        request: ChatCompletionRequest,
        onChunk?: (content: string) => void,
        signal?: AbortSignal
    ): Promise<string> {
        if (!this.config.apiKey) {
            throw new Error('Anthropic API key not configured')
        }

        const url = `${this.config.baseUrl}/v1/messages`

        // Convert messages to Anthropic format
        const systemMessage = request.messages.find(m => m.role === 'system')
        const conversationMessages = request.messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content,
            }))

        const body = {
            model: request.model,
            messages: conversationMessages,
            max_tokens: request.max_tokens || 4096,
            temperature: request.temperature,
            top_p: request.top_p,
            stream: !!onChunk,
            ...(systemMessage && { system: systemMessage.content }),
        }

        const headers = {
            'x-api-key': this.config.apiKey,
            'anthropic-version': '2023-06-01',
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
                    `Anthropic request failed: ${response.statusText}${errorData.error?.message ? ` - ${errorData.error.message}` : ''
                    }`
                )
            }

            const data = await response.json()
            const content = data.content?.[0]?.text || ''

            return content
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
                `Anthropic request failed: ${response.statusText}${errorData.error?.message ? ` - ${errorData.error.message}` : ''
                }`
            )
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
                const lines = chunk
                    .split('\n')
                    .filter(line => line.trim() && line.startsWith('data: '))

                for (const line of lines) {
                    if (line === 'data: [DONE]') continue

                    try {
                        const json = JSON.parse(line.slice(6))

                        if (json.type === 'content_block_delta') {
                            const delta = json.delta?.text
                            if (delta) {
                                fullContent += delta
                                onChunk(delta)
                            }
                        }

                        if (json.type === 'message_stop') {
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

        return fullContent
    }

    async testConnection(timeout = 5000): Promise<boolean> {
        try {
            if (!this.config.apiKey) {
                return false
            }

            // Test with a minimal request
            const response = await this.fetchWithTimeout(
                `${this.config.baseUrl}/v1/messages`,
                {
                    method: 'POST',
                    headers: {
                        'x-api-key': this.config.apiKey,
                        'anthropic-version': '2023-06-01',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: 'claude-3-haiku-20240307',
                        messages: [{ role: 'user', content: 'Hi' }],
                        max_tokens: 10,
                    }),
                },
                timeout
            )

            return response.ok
        } catch (error) {
            return false
        }
    }
}
