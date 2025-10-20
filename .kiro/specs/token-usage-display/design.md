# Design Document

## Overview

This feature adds token counting and usage display to the chat interface. Users can view token statistics for each AI message by clicking the existing info button, which will expand to show a dropdown with detailed token usage information.

The implementation will integrate a tokenizer library to count tokens accurately for different AI providers (OpenAI, Anthropic) and display the results in a clean, unobtrusive UI component.

## Architecture

### Component Structure

```
ChatMessage (existing)
├── Info Button (existing)
└── TokenUsageDropdown (new)
    ├── Token count display
    ├── Input/Output breakdown
    └── Cost estimation (optional)
```

### Data Flow

1. **Token Counting**: When an AI response is received, calculate tokens for:
   - Input tokens (user message + context)
   - Output tokens (AI response)
   - Total tokens

2. **Storage**: Store token usage in the `Message.metadata` object:
   ```typescript
   metadata: {
     tokenUsage: {
       inputTokens: number
       outputTokens: number
       totalTokens: number
     }
   }
   ```

3. **Display**: When info button is clicked, show dropdown with token statistics

## Components and Interfaces

### 1. Tokenizer Service

**Location**: `src/lib/tokenizer.ts`

**Purpose**: Provide token counting functionality for different AI providers

**Interface**:
```typescript
export interface TokenCount {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export class Tokenizer {
  // Count tokens for a given text and model
  static countTokens(text: string, model: string, provider: ProviderType): number
  
  // Count tokens for a complete message exchange
  static countMessageTokens(
    messages: Array<{ role: string; content: string }>,
    model: string,
    provider: ProviderType
  ): TokenCount
}
```

**Implementation Strategy**:
- Use `tiktoken` library for OpenAI models (GPT-3.5, GPT-4, o1, o3)
- Use `@anthropic-ai/tokenizer` for Anthropic models (Claude)
- Use `tiktoken` with appropriate encoding for Ollama models:
  - Llama models: Use `cl100k_base` encoding (similar to GPT-4)
  - Mistral models: Use `cl100k_base` encoding
  - Qwen models: Use `cl100k_base` encoding
  - Other models: Use `cl100k_base` as default
- Fallback to character-based estimation only when libraries fail

### 2. TokenUsageDropdown Component

**Location**: `src/components/TokenUsageDropdown.tsx`

**Purpose**: Display token usage statistics in an expandable dropdown

**Props**:
```typescript
interface TokenUsageDropdownProps {
  tokenUsage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  isOpen: boolean
  onToggle: () => void
}
```

**UI Design**:
```
┌─────────────────────────────┐
│ Token Usage                 │
├─────────────────────────────┤
│ Input:    1,234 tokens      │
│ Output:   567 tokens        │
│ Total:    1,801 tokens      │
└─────────────────────────────┘
```

### 3. ChatMessage Component Updates

**Location**: `src/components/ChatMessage.tsx`

**Changes**:
1. Add state for dropdown visibility:
   ```typescript
   const [isTokenDropdownOpen, setIsTokenDropdownOpen] = useState(false)
   ```

2. Update info button to toggle dropdown:
   ```typescript
   <button
     onClick={() => setIsTokenDropdownOpen(!isTokenDropdownOpen)}
     className="p-1.5 rounded hover:bg-white/10 transition-colors"
     title="Info"
   >
     <img src={infoIcon} alt="Info" className="w-4 h-4" />
   </button>
   ```

3. Render TokenUsageDropdown below info button:
   ```typescript
   {isTokenDropdownOpen && message.metadata?.tokenUsage && (
     <TokenUsageDropdown
       tokenUsage={message.metadata.tokenUsage}
       isOpen={isTokenDropdownOpen}
       onToggle={() => setIsTokenDropdownOpen(!isTokenDropdownOpen)}
     />
   )}
   ```

### 4. useChatWithTools Hook Updates

**Location**: `src/hooks/useChatWithTools.ts`

**Changes**:
1. Import tokenizer service
2. Calculate token usage after receiving AI response:
   ```typescript
   // After streaming completes
   const tokenUsage = Tokenizer.countMessageTokens(
     messages,
     model,
     providerConfig.type
   )
   
   // Update message metadata
   updateMessage(session.id, assistantMessage.id, {
     ...assistantMessage,
     metadata: {
       ...assistantMessage.metadata,
       tokenUsage
     }
   })
   ```

## Data Models

### Extended Message Type

Update `src/types/index.ts`:

```typescript
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  images?: ImageAttachment[]
  isReasoning?: boolean
  isHidden?: boolean
  status?: 'thinking' | 'searching' | 'processing' | 'generating' | 'cancelled'
  isStreaming?: boolean
  metadata?: {
    model?: string
    provider?: string
    tokensUsed?: number // Deprecated - use tokenUsage instead
    tokenUsage?: {      // New field
      inputTokens: number
      outputTokens: number
      totalTokens: number
    }
    renderTime?: number
    autoSearch?: {
      // ... existing fields
    }
  }
}
```

## Error Handling

### Tokenizer Errors

1. **Library not available**: Fall back to character-based estimation
   ```typescript
   try {
     return tiktoken.encode(text).length
   } catch (error) {
     console.warn('Tiktoken not available, using character estimation')
     return Math.ceil(text.length / 4) // Rough estimate: 1 token ≈ 4 chars
   }
   ```

2. **Unknown model**: Use default encoding for provider
   ```typescript
   if (!modelEncodings[model]) {
     console.warn(`Unknown model ${model}, using default encoding`)
     return getDefaultEncoding(provider)
   }
   ```

3. **Calculation failure**: Don't block UI, show "N/A" in dropdown
   ```typescript
   {tokenUsage ? (
     <span>{tokenUsage.totalTokens.toLocaleString()} tokens</span>
   ) : (
     <span className="text-gray-500">N/A</span>
   )}
   ```

## Testing Strategy

### Unit Tests

1. **Tokenizer Service**:
   - Test token counting for different providers
   - Test fallback estimation
   - Test edge cases (empty strings, very long texts)

2. **TokenUsageDropdown Component**:
   - Test rendering with valid token data
   - Test rendering without token data
   - Test toggle functionality

### Integration Tests

1. **End-to-End Flow**:
   - Send a message
   - Verify token usage is calculated
   - Verify token usage is stored in message metadata
   - Verify dropdown displays correct values

### Manual Testing

1. Test with different AI providers (OpenAI, Anthropic)
2. Test with different message lengths
3. Test with messages containing images
4. Test dropdown open/close behavior
5. Test UI responsiveness

## Implementation Notes

### Library Selection

**For OpenAI**:
- Use `tiktoken` (official OpenAI tokenizer)
- Supports all GPT models (GPT-3.5, GPT-4, o1, o3)
- Accurate token counting

**For Anthropic**:
- Use `@anthropic-ai/tokenizer` (official Anthropic tokenizer)
- Supports all Claude models
- Accurate token counting

**For Ollama and Local Models**:
- Use `tiktoken` with `cl100k_base` encoding (GPT-4 tokenizer)
- Most modern open-source models (Llama, Mistral, Qwen) use similar tokenization
- Provides good approximation for token counts
- Important for local model users to track resource usage

**Fallback**:
- Character-based estimation: `tokens ≈ characters / 4`
- Used only when tiktoken library fails to load
- Less accurate but better than no information

### Performance Considerations

1. **Lazy Loading**: Only calculate tokens when info button is clicked (optional optimization)
2. **Caching**: Cache token counts to avoid recalculation
3. **Async Calculation**: Calculate tokens asynchronously to avoid blocking UI

### UI/UX Considerations

1. **Positioning**: Dropdown appears directly below info button
2. **Styling**: Match existing design system (dark theme, rounded corners)
3. **Animation**: Smooth expand/collapse transition
4. **Accessibility**: Keyboard navigation support, ARIA labels
5. **Mobile**: Ensure dropdown is readable on small screens

## Future Enhancements

1. **Cost Estimation**: Show estimated cost based on provider pricing
2. **Session Totals**: Show cumulative token usage for entire session
3. **Export**: Allow exporting token usage data
4. **Warnings**: Alert user when approaching token limits
5. **History**: Track token usage over time
