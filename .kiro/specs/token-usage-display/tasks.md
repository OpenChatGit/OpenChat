# Implementation Plan

- [x] 1. Set up tokenizer service and dependencies





  - Install required npm packages: `tiktoken` for OpenAI/Ollama and `@anthropic-ai/tokenizer` for Anthropic
  - Create `src/lib/tokenizer.ts` with TokenCount interface and Tokenizer class
  - Implement token counting methods for OpenAI models using tiktoken with model-specific encodings
  - Implement token counting methods for Anthropic models using @anthropic-ai/tokenizer
  - Implement token counting for Ollama/local models using tiktoken with cl100k_base encoding
  - Implement fallback character-based estimation when libraries fail
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2. Create TokenUsageDropdown component





  - Create `src/components/TokenUsageDropdown.tsx` with props interface
  - Implement dropdown UI with input/output/total token display
  - Add expand/collapse animation
  - Style component to match existing design system (dark theme, rounded corners)
  - Add accessibility features (ARIA labels, keyboard navigation)
  - _Requirements: 1.2, 1.3, 3.1, 3.2, 3.3_

- [x] 3. Update Message type definition





  - Modify `src/types/index.ts` to add tokenUsage field to Message.metadata
  - Define TokenUsage interface with inputTokens, outputTokens, totalTokens
  - _Requirements: 4.3_

- [x] 4. Integrate token counting into useChatWithTools hook





  - Import Tokenizer service in `src/hooks/useChatWithTools.ts`
  - Calculate token usage after AI response completes (after streaming finishes)
  - Store token usage in message metadata using updateMessage
  - Handle errors gracefully with try-catch and fallback to undefined
  - _Requirements: 1.1, 2.3, 4.1, 4.2, 4.4_

- [x] 5. Update ChatMessage component to display token usage





  - Add state for dropdown visibility in `src/components/ChatMessage.tsx`
  - Update info button onClick handler to toggle dropdown
  - Render TokenUsageDropdown component below info button when open
  - Pass tokenUsage from message.metadata to dropdown component
  - Handle case when tokenUsage is undefined (show nothing or "N/A")
  - _Requirements: 1.2, 1.3, 3.1, 3.2, 3.3_

- [ ]* 6. Add error handling and edge cases
  - Test with empty messages and very long messages
  - Test with messages containing images
  - Test with different providers (OpenAI, Anthropic, Ollama, LMStudio, LlamaCPP)
  - Test with various Ollama models (Llama, Mistral, Qwen, Gemma)
  - Verify fallback estimation works when libraries are unavailable
  - _Requirements: 4.4_

- [ ]* 7. Write unit tests for tokenizer service
  - Test token counting for OpenAI models
  - Test token counting for Anthropic models
  - Test token counting for Ollama models (Llama, Mistral, Qwen)
  - Test fallback estimation
  - Test edge cases (empty strings, very long texts, special characters)
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ]* 8. Write component tests for TokenUsageDropdown
  - Test rendering with valid token data
  - Test rendering without token data
  - Test toggle functionality
  - Test accessibility features
  - _Requirements: 1.2, 1.3, 3.3_
