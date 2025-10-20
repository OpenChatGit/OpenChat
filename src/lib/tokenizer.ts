import { ProviderType } from '../types';

export interface TokenCount {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export class Tokenizer {
  private static tiktokenCache: Map<string, any> = new Map();
  private static anthropicTokenizerCache: any = null;

  /**
   * Count tokens for a given text and model
   */
  static countTokens(text: string, model: string, provider: ProviderType): number {
    if (!text) return 0;

    try {
      switch (provider) {
        case 'openai':
          return this.countOpenAITokens(text, model);
        case 'anthropic':
          return this.countAnthropicTokens(text, model);
        case 'ollama':
        case 'lmstudio':
        case 'llamacpp':
        case 'koboldcpp':
        case 'textgen-webui':
          return this.countOllamaTokens(text, model);
        default:
          return this.fallbackEstimation(text);
      }
    } catch (error) {
      console.warn(`Token counting failed for ${provider}/${model}, using fallback:`, error);
      return this.fallbackEstimation(text);
    }
  }

  /**
   * Count tokens for OpenAI models using tiktoken
   */
  private static countOpenAITokens(text: string, model: string): number {
    try {
      // Dynamic import to avoid bundling issues
      const { get_encoding } = require('tiktoken');
      
      // Map model names to encodings
      const modelEncodings: Record<string, string> = {
        'gpt-4': 'cl100k_base',
        'gpt-4-turbo': 'cl100k_base',
        'gpt-4o': 'o200k_base',
        'gpt-4o-mini': 'o200k_base',
        'gpt-3.5-turbo': 'cl100k_base',
        'o1': 'o200k_base',
        'o1-mini': 'o200k_base',
        'o3': 'o200k_base',
        'o3-mini': 'o200k_base',
      };

      // Find the appropriate encoding
      let encodingName = 'cl100k_base'; // Default
      for (const [modelPrefix, encoding] of Object.entries(modelEncodings)) {
        if (model.toLowerCase().includes(modelPrefix)) {
          encodingName = encoding;
          break;
        }
      }

      // Get or create encoder
      let encoder = this.tiktokenCache.get(encodingName);
      if (!encoder) {
        encoder = get_encoding(encodingName);
        this.tiktokenCache.set(encodingName, encoder);
      }

      const tokens = encoder.encode(text);
      return tokens.length;
    } catch (error) {
      console.warn('tiktoken not available for OpenAI, using fallback:', error);
      return this.fallbackEstimation(text);
    }
  }

  /**
   * Count tokens for Anthropic models using @anthropic-ai/tokenizer
   */
  private static countAnthropicTokens(text: string, _model: string): number {
    try {
      // Dynamic import to avoid bundling issues
      const { countTokens } = require('@anthropic-ai/tokenizer');
      
      if (!this.anthropicTokenizerCache) {
        this.anthropicTokenizerCache = countTokens;
      }

      return countTokens(text);
    } catch (error) {
      console.warn('Anthropic tokenizer not available, using fallback:', error);
      return this.fallbackEstimation(text);
    }
  }

  /**
   * Count tokens for Ollama and local models using tiktoken with cl100k_base encoding
   */
  private static countOllamaTokens(text: string, _model: string): number {
    try {
      // Dynamic import to avoid bundling issues
      const { get_encoding } = require('tiktoken');
      
      // Use cl100k_base encoding (GPT-4 tokenizer) for all local models
      // This provides a good approximation for most modern models (Llama, Mistral, Qwen, etc.)
      let encoder = this.tiktokenCache.get('cl100k_base');
      if (!encoder) {
        encoder = get_encoding('cl100k_base');
        this.tiktokenCache.set('cl100k_base', encoder);
      }

      const tokens = encoder.encode(text);
      return tokens.length;
    } catch (error) {
      console.warn('tiktoken not available for Ollama, using fallback:', error);
      return this.fallbackEstimation(text);
    }
  }

  /**
   * Fallback character-based estimation when libraries fail
   * Rough estimate: 1 token ≈ 4 characters
   */
  private static fallbackEstimation(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Count tokens for a complete message exchange
   */
  static countMessageTokens(
    messages: Array<{ role: string; content: string }>,
    model: string,
    provider: ProviderType
  ): TokenCount {
    try {
      // Calculate input tokens (all messages except the last assistant message)
      let inputTokens = 0;
      let outputTokens = 0;

      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        const tokenCount = this.countTokens(message.content, model, provider);

        // The last message is typically the assistant's response (output)
        if (i === messages.length - 1 && message.role === 'assistant') {
          outputTokens = tokenCount;
        } else {
          inputTokens += tokenCount;
        }

        // Add overhead for message formatting (role, delimiters, etc.)
        // OpenAI adds ~4 tokens per message for formatting
        inputTokens += 4;
      }

      const totalTokens = inputTokens + outputTokens;

      return {
        inputTokens,
        outputTokens,
        totalTokens,
      };
    } catch (error) {
      console.error('Error counting message tokens:', error);
      // Return fallback estimation
      const totalText = messages.map(m => m.content).join(' ');
      const total = this.fallbackEstimation(totalText);
      return {
        inputTokens: Math.floor(total * 0.7), // Estimate 70% input
        outputTokens: Math.floor(total * 0.3), // Estimate 30% output
        totalTokens: total,
      };
    }
  }

  /**
   * Clean up cached encoders
   */
  static cleanup(): void {
    // Free encoders if they have a free method
    for (const encoder of this.tiktokenCache.values()) {
      if (encoder && typeof encoder.free === 'function') {
        try {
          encoder.free();
        } catch (error) {
          console.warn('Error freeing encoder:', error);
        }
      }
    }
    this.tiktokenCache.clear();
    this.anthropicTokenizerCache = null;
  }
}
