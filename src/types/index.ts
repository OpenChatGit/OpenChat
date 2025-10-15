// Core types for the modular provider system

export type ProviderType = 'ollama' | 'lmstudio' | 'llamacpp' | 'koboldcpp' | 'textgen-webui' | 'anthropic' | 'openai';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isReasoning?: boolean; // Flag to indicate if this is a reasoning model response
  isHidden?: boolean; // Hide from UI (tool results, etc.)
  status?: 'thinking' | 'searching' | 'processing' | 'generating' | 'cancelled'; // Status indicator
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
