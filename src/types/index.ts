// Core types for the modular provider system

export type ProviderType = 'ollama' | 'lmstudio' | 'llamacpp' | 'koboldcpp' | 'textgen-webui' | 'anthropic' | 'openai';

export interface ImageAttachment {
  id: string;
  data: string; // Base64 encoded image data
  mimeType: string; // e.g., 'image/jpeg', 'image/png'
  fileName: string;
  size: number; // File size in bytes
  width?: number;
  height?: number;
  url?: string; // Optional: For displaying the image
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  images?: ImageAttachment[]; // Array of attached images
  isReasoning?: boolean; // Flag to indicate if this is a reasoning model response
  isHidden?: boolean; // Hide from UI (tool results, etc.)
  status?: 'thinking' | 'searching' | 'processing' | 'generating' | 'cancelled'; // Status indicator
  isStreaming?: boolean; // Track if message is actively streaming
  metadata?: {
    model?: string;
    provider?: string;
    tokensUsed?: number;
    tokenUsage?: TokenUsage;
    renderTime?: number; // Track rendering performance
    autoSearch?: {
      triggered: boolean;
      query: string;
      sources: Array<{
        url: string;
        title: string;
        domain: string;
        publishedDate?: Date;
      }>;
      chunkCount: number;
      searchTime: number;
    };
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  provider: ProviderType;
  model: string;
  createdAt: number;
  updatedAt: number;
}

export interface ModelInfo {
  name: string;
  size?: string;
  modified?: string;
  digest?: string;
  details?: Record<string, any>;
  capabilities?: {
    vision?: boolean; // Indicates if model supports vision
    maxImageSize?: number; // Max image size in bytes
    maxImages?: number; // Max number of images per message
    reasoning?: boolean; // Indicates if model supports reasoning/thinking
  };
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export interface ProviderConfig {
  type: ProviderType;
  name: string;
  baseUrl: string;
  enabled: boolean;
  apiKey?: string;
  hiddenModels?: string[];
}

export interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export interface ChatCompletionResponse {
  id?: string;
  object?: string;
  created?: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      reasoning_content?: string;
    };
    finish_reason?: string;
  }>;
}

export interface StreamResponse {
  id?: string;
  object?: string;
  created?: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      reasoning_content?: string;
    };
    finish_reason?: string | null;
  }>;
}
