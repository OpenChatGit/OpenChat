// Tool Call System Types

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string // JSON string
  }
}

export interface ToolCallResult {
  toolCallId: string
  result: string
  error?: string
  timestamp: number
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, {
        type: string
        description: string
        enum?: string[]
      }>
      required: string[]
    }
  }
}

export interface MessageWithToolCalls {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: number
  toolCalls?: ToolCall[]
  toolCallId?: string // For tool response messages
}

export interface ToolExecutionContext {
  enabled: boolean
  availableTools: ToolDefinition[]
  pendingCalls: ToolCall[]
  results: ToolCallResult[]
}
