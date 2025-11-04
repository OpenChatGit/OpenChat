// Enhanced useChat hook with Tool Call support

import { useState, useCallback, useRef, useEffect } from 'react'
import type { ChatSession, Message, ProviderConfig, ImageAttachment } from '../types'
import type { ToolCall, ToolCallResult } from '../types/tools'
import { ProviderFactory } from '../providers'
import { generateId } from '../lib/utils'
import { ToolExecutor } from '../lib/toolExecutor'
import type { PluginManager } from '../plugins/core'
import { AutoSearchManager } from '../lib/web-search/autoSearchManager'
import type { SearchContext } from '../lib/web-search/types'
import type { WebSearchSettings } from '../components/WebSearchSettings'
import { loadWebSearchSettings, saveWebSearchSettings } from '../lib/web-search/settingsStorage'
import { Tokenizer } from '../lib/tokenizer'
import { debugPersonaState, logPersonaDebug, isPersonaDebugEnabled } from '../lib/personaDebug'

// Global system prompt constant
// This can be customized in the future to allow user-defined global prompts
export const DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant."


export function useChatWithTools(pluginManager: PluginManager) {
  // Load sessions from localStorage on initial mount
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem('chat-sessions')
      return saved ? JSON.parse(saved) : []
    } catch (error) {
      console.error('Failed to load sessions from localStorage:', error)
      return []
    }
  })

  // Load current session from localStorage on initial mount
  const [currentSession, setCurrentSessionState] = useState<ChatSession | null>(() => {
    try {
      const saved = localStorage.getItem('current-session')
      return saved ? JSON.parse(saved) : null
    } catch (error) {
      console.error('Failed to load current session from localStorage:', error)
      return null
    }
  })

  // Wrapper for setCurrentSession that clears SourceRegistry when switching sessions
  const setCurrentSession = useCallback((sessionOrUpdater: ChatSession | null | ((prev: ChatSession | null) => ChatSession | null)) => {
    // Clear SourceRegistry when switching to a different session
    const sourceRegistry = autoSearchManager.current.getOrchestrator().getSourceRegistry()
    sourceRegistry.clear()
    console.log('[useChatWithTools] SourceRegistry cleared for session switch')

    setCurrentSessionState(sessionOrUpdater)
  }, [])

  const [isGenerating, setIsGenerating] = useState(false)
  const [autoSearchEnabled, setAutoSearchEnabled] = useState(false)
  const [webSearchSettings, setWebSearchSettings] = useState<WebSearchSettings | null>(null)

  // Persona state management
  const [personaPrompt, setPersonaPrompt] = useState<string>('')
  const [personaEnabled, setPersonaEnabled] = useState<boolean>(false)

  const streamingContentRef = useRef<string>('')
  const toolExecutor = useRef(new ToolExecutor(pluginManager))
  const autoSearchManager = useRef(new AutoSearchManager())
  const settingsInitialized = useRef(false)

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    try {
      const serialized = JSON.stringify(sessions)
      const sizeInBytes = new Blob([serialized]).size
      const sizeInMB = sizeInBytes / (1024 * 1024)

      // Warn if approaching localStorage limits (typically 5-10MB)
      if (sizeInMB > 4) {
        console.warn(`Session storage size is ${sizeInMB.toFixed(2)}MB. Consider clearing old sessions with images.`)
      }

      localStorage.setItem('chat-sessions', serialized)
    } catch (error) {
      console.error('Failed to save sessions to localStorage:', error)

      // Check if it's a quota exceeded error
      if (error instanceof DOMException && (
        error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      )) {
        console.error('localStorage quota exceeded. Sessions with images may be too large.')
        // Optionally notify user through a toast or alert
      }
    }
  }, [sessions])

  // Save current session to localStorage whenever it changes
  useEffect(() => {
    try {
      if (currentSession) {
        const serialized = JSON.stringify(currentSession)
        const sizeInBytes = new Blob([serialized]).size
        const sizeInMB = sizeInBytes / (1024 * 1024)

        // Warn if session is very large
        if (sizeInMB > 2) {
          console.warn(`Current session size is ${sizeInMB.toFixed(2)}MB. Images are contributing to storage size.`)
        }

        localStorage.setItem('current-session', serialized)
      } else {
        localStorage.removeItem('current-session')
      }
    } catch (error) {
      console.error('Failed to save current session to localStorage:', error)

      // Check if it's a quota exceeded error
      if (error instanceof DOMException && (
        error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      )) {
        console.error('localStorage quota exceeded. Current session with images may be too large.')
        // Optionally notify user through a toast or alert
      }
    }
  }, [currentSession])

  // Load settings on mount and apply to AutoSearchManager
  useEffect(() => {
    if (settingsInitialized.current) return
    settingsInitialized.current = true

    const settings = loadWebSearchSettings()
    setWebSearchSettings(settings)
    setAutoSearchEnabled(settings.autoSearchEnabled)

    // Apply settings to AutoSearchManager
    autoSearchManager.current.configure({
      enabled: settings.autoSearchEnabled,
      maxResults: settings.maxResults,
      timeout: 30000,
      outputFormat: 'verbose',
      maxContextLength: 8000
    })

    // Apply RAG configuration
    const ragProcessor = (autoSearchManager.current as any).ragProcessor
    if (ragProcessor && ragProcessor.configure) {
      ragProcessor.configure(settings.ragConfig)
    }

    // Apply cache settings to orchestrator
    const orchestrator = (autoSearchManager.current as any).orchestrator
    if (orchestrator && settings.cacheEnabled === false) {
      orchestrator.clearCache()
    }
  }, [])

  // Sync persona state from currentSession when session changes
  useEffect(() => {
    if (currentSession) {
      setPersonaPrompt(currentSession.personaPrompt || '')
      setPersonaEnabled(currentSession.personaEnabled || false)
    } else {
      setPersonaPrompt('')
      setPersonaEnabled(false)
    }
  }, [currentSession])

  // Update settings handler
  const updateWebSearchSettings = useCallback((newSettings: WebSearchSettings) => {
    setWebSearchSettings(newSettings)
    setAutoSearchEnabled(newSettings.autoSearchEnabled)
    saveWebSearchSettings(newSettings)

    // Apply settings to AutoSearchManager
    autoSearchManager.current.configure({
      enabled: newSettings.autoSearchEnabled,
      maxResults: newSettings.maxResults,
      timeout: 30000,
      outputFormat: 'verbose',
      maxContextLength: 8000
    })

    // Apply RAG configuration
    const ragProcessor = (autoSearchManager.current as any).ragProcessor
    if (ragProcessor && ragProcessor.configure) {
      ragProcessor.configure(newSettings.ragConfig)
    }

    // Apply cache settings
    const orchestrator = (autoSearchManager.current as any).orchestrator
    if (orchestrator) {
      if (newSettings.cacheEnabled === false) {
        orchestrator.clearCache()
      }
    }
  }, [])

  const createSession = useCallback((provider: ProviderConfig, model: string, initialMessage?: Message) => {
    const newSession: ChatSession = {
      id: generateId(),
      title: 'New Chat',
      messages: initialMessage ? [initialMessage] : [],
      provider: provider.type,
      model,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      personaPrompt: undefined,
      personaEnabled: false,
    }

    setSessions(prev => [newSession, ...prev])
    setCurrentSession(newSession)
    return newSession
  }, [])

  const updatePersona = useCallback((prompt: string, enabled: boolean) => {
    if (!currentSession) {
      console.warn('[updatePersona] No current session')
      return
    }

    console.log('[updatePersona] Updating persona:', {
      sessionId: currentSession.id,
      prompt: prompt.substring(0, 50) + '...',
      enabled
    })

    // Update sessions state
    setSessions(prev =>
      prev.map(s =>
        s.id === currentSession.id
          ? { ...s, personaPrompt: prompt, personaEnabled: enabled, updatedAt: Date.now() }
          : s
      )
    )

    // Update current session
    setCurrentSession(prev => {
      if (!prev) return null
      return { ...prev, personaPrompt: prompt, personaEnabled: enabled }
    })

    // Update local state immediately
    setPersonaPrompt(prompt)
    setPersonaEnabled(enabled)

    console.log('[updatePersona] Persona updated successfully')
  }, [currentSession])

  const combineSystemPrompts = useCallback((globalPrompt: string, personaPrompt: string, personaEnabled: boolean): string => {
    if (!personaEnabled || !personaPrompt.trim()) {
      return globalPrompt
    }

    // Combine with clear separation
    return `${globalPrompt}\n\n--- Persona Instructions ---\n${personaPrompt}`
  }, [])

  const updateSessionTitle = useCallback((sessionId: string, title: string) => {
    setSessions(prev =>
      prev.map(s => s.id === sessionId ? { ...s, title, updatedAt: Date.now() } : s)
    )
    if (currentSession?.id === sessionId) {
      setCurrentSession(prev => prev ? { ...prev, title } : null)
    }
  }, [currentSession])

  const addMessage = useCallback((sessionId: string, message: Message) => {
    setSessions(prev =>
      prev.map(s =>
        s.id === sessionId
          ? { ...s, messages: [...s.messages, message], updatedAt: Date.now() }
          : s
      )
    )

    setCurrentSession(prev => {
      if (prev?.id === sessionId) {
        return { ...prev, messages: [...prev.messages, message], updatedAt: Date.now() }
      }
      return prev
    })
  }, [])

  const updateMessage = useCallback((sessionId: string, messageId: string, content: string) => {
    setSessions(prev =>
      prev.map(s =>
        s.id === sessionId
          ? {
            ...s,
            messages: s.messages.map(m =>
              m.id === messageId ? { ...m, content } : m
            ),
            updatedAt: Date.now(),
          }
          : s
      )
    )

    setCurrentSession(prev => {
      if (prev?.id === sessionId) {
        return {
          ...prev,
          messages: prev.messages.map(m =>
            m.id === messageId ? { ...m, content } : m
          ),
          updatedAt: Date.now(),
        }
      }
      return prev
    })
  }, [])

  /**
   * Execute tool calls and return results
   */
  const executeToolCalls = useCallback(async (
    toolCalls: ToolCall[],
    sessionId: string
  ): Promise<ToolCallResult[]> => {
    console.log(`Executing ${toolCalls.length} tool calls...`)

    // Add a system message indicating tool execution
    const toolExecutionMessage: Message = {
      id: generateId(),
      role: 'system',
      content: `🔧 Executing ${toolCalls.length} tool call(s)...`,
      timestamp: Date.now(),
    }
    addMessage(sessionId, toolExecutionMessage)

    // Execute all tool calls
    const results = await toolExecutor.current.executeToolCalls(toolCalls)

    // Add tool results as system messages
    for (const result of results) {
      const content = result.error
        ? `Tool execution failed: ${result.error}`
        : `Tool result: ${result.result}`

      const resultMessage: Message = {
        id: generateId(),
        role: 'system',
        content,
        timestamp: Date.now(),
      }
      addMessage(sessionId, resultMessage)
    }

    return results
  }, [addMessage])

  /**
   * Generate an enhanced fallback title from the first message
   * Removes markdown formatting, handles code snippets, and ensures readability
   */
  const generateFallbackTitle = (message: string): string => {
    if (!message || message.trim().length === 0) {
      return 'New Chat'
    }

    let cleaned = message.trim()

    // Step 1: Remove markdown code blocks and replace with placeholder
    // Multi-line code blocks: ```code```
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '[code]')

    // Inline code: `code`
    cleaned = cleaned.replace(/`[^`]+`/g, '[code]')

    // Step 2: Remove other markdown formatting
    // Images: ![alt](url) - must come before links to avoid conflicts
    cleaned = cleaned.replace(/!\[[^\]]*\]\([^)]+\)/g, '[image]')

    // Links: [text](url)
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

    // Headers: # Header
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '')

    // Bold: **text** or __text__
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1')
    cleaned = cleaned.replace(/__([^_]+)__/g, '$1')

    // Italic: *text* or _text_
    cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1')
    cleaned = cleaned.replace(/_([^_]+)_/g, '$1')

    // Strikethrough: ~~text~~
    cleaned = cleaned.replace(/~~([^~]+)~~/g, '$1')

    // Blockquotes: > text
    cleaned = cleaned.replace(/^>\s+/gm, '')

    // Lists: - item or * item or 1. item
    cleaned = cleaned.replace(/^[\s]*[-*+]\s+/gm, '')
    cleaned = cleaned.replace(/^[\s]*\d+\.\s+/gm, '')

    // Step 3: Normalize whitespace (replace multiple spaces/newlines with single space)
    cleaned = cleaned.replace(/\s+/g, ' ').trim()

    // Step 4: If still empty after cleaning, return default
    if (cleaned.length === 0) {
      return 'New Chat'
    }

    // Step 5: Truncate to reasonable length (50 chars) at word boundary
    if (cleaned.length > 50) {
      // Try to find last space before 50 chars
      const truncated = cleaned.slice(0, 50)
      const lastSpace = truncated.lastIndexOf(' ')

      if (lastSpace > 20) {
        // Use word boundary if it's not too early
        cleaned = truncated.slice(0, lastSpace) + '...'
      } else {
        // Otherwise just truncate at 50 chars
        cleaned = truncated + '...'
      }
    }

    // Step 6: Final validation - ensure we have something readable
    // If title is just placeholders or very short, use a more descriptive default
    if (cleaned === '[code]' || cleaned === '[image]' || cleaned.length < 3) {
      return 'New Chat'
    }

    return cleaned
  }

  /**
   * Extract and validate a generated title from response
   * Supports both {title}...{/title} format and plain text
   */
  const cleanAndValidateTitle = (rawTitle: string): string | null => {
    if (!rawTitle) return null

    let cleaned = rawTitle.trim()

    // Step 1: Try to extract title from {title}...{/title} tags first
    // This is the preferred format for all models
    const titleMatch = cleaned.match(/\{title\}([\s\S]*?)\{\/title\}/i)
    if (titleMatch) {
      // Extract content between tags (even if empty)
      cleaned = titleMatch[1].trim()
      // If empty after extraction, return null early
      if (cleaned.length === 0) return null
    } else {
      // Fallback: Try to extract from incomplete {title} tag (if response was cut off)
      const incompleteTitleMatch = cleaned.match(/\{title\}([\s\S]*?)$/i)
      if (incompleteTitleMatch) {
        cleaned = incompleteTitleMatch[1].trim()
      } else {
        // Remove reasoning content from reasoning models (o1, o3, qwen, etc.)
        // These models wrap reasoning in <think>...</think> tags

        // Remove complete <think>...</think> pairs
        cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

        // Remove incomplete/unclosed <think> tags (happens when max_tokens cuts off response)
        cleaned = cleaned.replace(/<think>[\s\S]*$/g, '').trim()

        // Remove any stray closing tags
        cleaned = cleaned.replace(/<\/think>/g, '').trim()
      }
    }

    // Step 2: Trim whitespace
    cleaned = cleaned.trim()

    // Step 3: Remove surrounding quotes (single, double, and smart quotes)
    // Handle multiple layers of quotes
    while (cleaned.length > 0 && /^["'`''""«»]/.test(cleaned) && /["'`''""«»]$/.test(cleaned)) {
      cleaned = cleaned.slice(1, -1).trim()
    }

    // Step 4: Normalize whitespace (replace multiple spaces/tabs/newlines with single space)
    cleaned = cleaned.replace(/\s+/g, ' ')

    // Step 5: Remove or replace problematic special characters
    // Keep alphanumeric, spaces, and common punctuation (.,!?-:)
    cleaned = cleaned.replace(/[^\w\s.,!?:\-']/g, '')

    // Step 6: Final trim after character removal
    cleaned = cleaned.trim()

    // Step 7: Remove common placeholder words that models sometimes include
    // Remove "Title:", "Summary:", etc. at the start
    cleaned = cleaned.replace(/^(title|summary|topic|subject|heading):\s*/i, '')

    // Remove standalone words like "Title" or "Summary" if that's all there is
    if (/^(title|summary|topic|subject|heading)$/i.test(cleaned)) {
      return null
    }

    // Validation: Check if title is meaningful
    if (cleaned.length < 3) return null

    // Validation: Reject titles that are only punctuation or whitespace
    if (/^[.,!?:\-\s]+$/.test(cleaned)) return null

    // Validation: Ensure title has at least one alphanumeric character
    if (!/[a-zA-Z0-9]/.test(cleaned)) return null

    // Step 8: Limit to 60 characters
    if (cleaned.length > 60) {
      cleaned = cleaned.slice(0, 60).trim()
    }

    return cleaned
  }

  /**
   * Prepare message content for title generation by handling edge cases
   */
  const prepareMessageForTitle = (message: string): string => {
    // Handle very short messages (<10 chars) - use as-is
    if (message.length < 10) {
      return message
    }

    // Remove markdown code blocks and inline code
    let cleaned = message
      .replace(/```[\s\S]*?```/g, '[code]') // Multi-line code blocks
      .replace(/`[^`]+`/g, '[code]') // Inline code

    // Remove markdown formatting
    cleaned = cleaned
      .replace(/#{1,6}\s+/g, '') // Headers
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
      .replace(/\*([^*]+)\*/g, '$1') // Italic
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '[image]') // Images

    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim()

    // For long messages, take first 200 chars but try to end at a sentence boundary
    if (cleaned.length > 200) {
      const truncated = cleaned.slice(0, 200)
      // Try to find last sentence ending
      const lastPeriod = truncated.lastIndexOf('.')
      const lastQuestion = truncated.lastIndexOf('?')
      const lastExclamation = truncated.lastIndexOf('!')
      const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation)

      if (lastSentenceEnd > 50) {
        // Use sentence boundary if it's not too early
        return truncated.slice(0, lastSentenceEnd + 1).trim()
      } else {
        // Otherwise, try to end at a word boundary
        const lastSpace = truncated.lastIndexOf(' ')
        return lastSpace > 50 ? truncated.slice(0, lastSpace).trim() : truncated.trim()
      }
    }

    return cleaned
  }

  /**
   * Generate a concise session title using AI with timeout and detailed error logging
   */
  const generateSessionTitle = async (
    sessionId: string,
    firstMessage: string,
    providerConfig: ProviderConfig,
    model: string
  ) => {
    const startTime = Date.now()
    const timeoutMs = 10000 // 10 second timeout

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('TIMEOUT'))
        }, timeoutMs)
      })

      // Create the title generation promise
      const generatePromise = (async () => {
        const provider = ProviderFactory.createProvider(providerConfig)

        // Prepare message content by handling edge cases
        const preparedMessage = prepareMessageForTitle(firstMessage)

        // Extremely simple and direct prompt
        const titlePrompt = `Summarize this in 3-5 words: "${preparedMessage}"

Format: {title}Your Summary{/title}`

        const response = await provider.sendMessage(
          {
            model,
            messages: [
              {
                role: 'system',
                content: 'Summarize messages in 3-5 words. Use format: {title}Summary{/title}'
              },
              {
                role: 'user',
                content: titlePrompt
              }
            ],
            stream: false,
            temperature: 0.1,  // Very low temperature for consistent, focused titles
            max_tokens: 50  // Short response needed
          },
          () => { }
        )

        return response
      })()

      // Race between timeout and generation
      const response = await Promise.race([generatePromise, timeoutPromise])

      const elapsedTime = Date.now() - startTime

      if (response) {
        const cleanTitle = cleanAndValidateTitle(response)
        if (cleanTitle) {
          updateSessionTitle(sessionId, cleanTitle)
          console.log(`[Title Generation] Success: Generated title in ${elapsedTime}ms`, {
            sessionId,
            provider: providerConfig.type,
            model,
            titleLength: cleanTitle.length,
            elapsedMs: elapsedTime
          })
        } else {
          console.warn(`[Title Generation] Validation Failed: Title did not pass validation`, {
            sessionId,
            provider: providerConfig.type,
            model,
            rawResponse: response,
            elapsedMs: elapsedTime,
            reason: 'Title validation failed - empty, too short, or invalid content'
          })
        }
      } else {
        console.warn(`[Title Generation] Empty Response: Provider returned empty response`, {
          sessionId,
          provider: providerConfig.type,
          model,
          elapsedMs: elapsedTime
        })
      }
    } catch (error) {
      const elapsedTime = Date.now() - startTime

      // Categorize and log errors with detailed context
      if (error instanceof Error && error.message === 'TIMEOUT') {
        console.error(`[Title Generation] TIMEOUT: Title generation exceeded ${timeoutMs}ms limit`, {
          sessionId,
          provider: providerConfig.type,
          model,
          timeoutMs,
          elapsedMs: elapsedTime,
          errorCategory: 'timeout',
          fallbackBehavior: 'Keeping fallback title'
        })
      } else if (error instanceof Error && error.message.includes('API key')) {
        console.error(`[Title Generation] AUTH ERROR: Invalid or missing API key`, {
          sessionId,
          provider: providerConfig.type,
          model,
          elapsedMs: elapsedTime,
          errorCategory: 'authentication',
          errorMessage: error.message,
          fallbackBehavior: 'Keeping fallback title'
        })
      } else if (error instanceof Error && (error.message.includes('network') || error.message.includes('fetch'))) {
        console.error(`[Title Generation] NETWORK ERROR: Failed to connect to provider`, {
          sessionId,
          provider: providerConfig.type,
          model,
          elapsedMs: elapsedTime,
          errorCategory: 'network',
          errorMessage: error.message,
          fallbackBehavior: 'Keeping fallback title'
        })
      } else if (error instanceof Error && error.message.includes('rate limit')) {
        console.error(`[Title Generation] RATE LIMIT: Provider rate limit exceeded`, {
          sessionId,
          provider: providerConfig.type,
          model,
          elapsedMs: elapsedTime,
          errorCategory: 'rate_limit',
          errorMessage: error.message,
          fallbackBehavior: 'Keeping fallback title'
        })
      } else {
        console.error(`[Title Generation] UNKNOWN ERROR: Unexpected error during title generation`, {
          sessionId,
          provider: providerConfig.type,
          model,
          elapsedMs: elapsedTime,
          errorCategory: 'unknown',
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          fallbackBehavior: 'Keeping fallback title'
        })
      }

      // Keep the fallback title - no action needed as it's already set
    }
  }

  /**
   * Send message with tool support
   */
  const sendMessage = useCallback(async (
    content: string,
    providerConfig: ProviderConfig,
    model: string,
    targetSession?: ChatSession,
    images?: ImageAttachment[],
    systemPrompt?: string
  ) => {
    const session = targetSession || currentSession
    if (!session) return

    // Process message through plugins (processOutgoing)
    let processedContent = content
    try {
      const messageProcessors = pluginManager.getByType('message-processor')
      for (const processor of messageProcessors) {
        if (processor.metadata.enabled && typeof (processor as any).processOutgoing === 'function') {
          const result = await (processor as any).processOutgoing(processedContent)
          if (typeof result === 'string') {
            processedContent = result
          }
        }
      }
    } catch (error) {
      console.error('[useChatWithTools] Error processing outgoing message:', error)
    }

    // Check if user message already exists
    const hasUserMessage = session.messages.some(m => m.role === 'user' && m.content === processedContent)

    let userMessage: Message

    if (!hasUserMessage) {
      userMessage = {
        id: generateId(),
        role: 'user',
        content: processedContent,
        timestamp: Date.now(),
        images: images && images.length > 0 ? images : undefined,
        metadata: {}
      }
      addMessage(session.id, userMessage)
    } else {
      userMessage = session.messages.find(m => m.role === 'user' && m.content === processedContent)!
    }

    // Auto-generate title from first message
    const isFirstMessage = session.messages.length === 0 || (session.messages.length === 1 && hasUserMessage)
    if (isFirstMessage) {
      // Use enhanced fallback title initially
      const fallbackTitle = generateFallbackTitle(content)
      updateSessionTitle(session.id, fallbackTitle)

      // Generate better title in background using AI
      generateSessionTitle(session.id, content, providerConfig, model).catch(err => {
        console.error('Failed to generate session title:', err)
      })
    }

    setIsGenerating(true)

    try {
      // Configure AutoSearchManager with current state
      autoSearchManager.current.configure({ enabled: autoSearchEnabled })

      // Check if auto-search should be triggered
      let enhancedContent = content
      let searchContext: SearchContext | null = null

      // Disable auto-search when images are attached to avoid conflicts
      // Images typically require visual analysis, not web search
      const hasImages = images && images.length > 0
      const shouldSkipSearch = hasImages

      if (autoSearchEnabled && !shouldSkipSearch) {
        const shouldSearch = await autoSearchManager.current.shouldSearch(
          content,
          session.messages
        )

        if (shouldSearch) {
          console.log('Auto-search triggered for query:', content)

          // Add "Searching..." system message
          const searchingMessage: Message = {
            id: generateId(),
            role: 'system',
            content: '🔍 Searching the web...',
            timestamp: Date.now(),
            status: 'searching'
          }
          addMessage(session.id, searchingMessage)

          const searchStartTime = Date.now()

          // Perform search
          searchContext = await autoSearchManager.current.performSearch(content)

          const searchTime = Date.now() - searchStartTime

          // Remove the searching message after completion
          if (searchContext) {
            // Remove the searching message from sessions
            setSessions(prev =>
              prev.map(s =>
                s.id === session.id
                  ? {
                    ...s,
                    messages: s.messages.filter(m => m.id !== searchingMessage.id)
                  }
                  : s
              )
            )

            // Also remove from current session
            setCurrentSession(prev => {
              if (prev?.id === session.id) {
                return {
                  ...prev,
                  messages: prev.messages.filter(m => m.id !== searchingMessage.id)
                }
              }
              return prev
            })

            // Inject context into user message (lazy-loaded formatter)
            enhancedContent = await autoSearchManager.current.injectContext(content, searchContext)

            // Store search metadata for use in callbacks
            const searchMetadata = {
              triggered: true,
              query: searchContext.query,
              sources: searchContext.sources,
              chunkCount: searchContext.chunks.length,
              searchTime
            }

            // Update user message with autoSearch metadata
            setSessions(prev =>
              prev.map(s =>
                s.id === session.id
                  ? {
                    ...s,
                    messages: s.messages.map(m =>
                      m.id === userMessage.id
                        ? {
                          ...m,
                          metadata: {
                            ...m.metadata,
                            autoSearch: searchMetadata
                          }
                        }
                        : m
                    )
                  }
                  : s
              )
            )

            // Also update current session
            setCurrentSession(prev => {
              if (prev?.id === session.id) {
                return {
                  ...prev,
                  messages: prev.messages.map(m =>
                    m.id === userMessage.id
                      ? {
                        ...m,
                        metadata: {
                          ...m.metadata,
                          autoSearch: searchMetadata
                        }
                      }
                      : m
                  )
                }
              }
              return prev
            })

            console.log('Auto-search completed:', {
              sources: searchContext.sources.length,
              chunks: searchContext.chunks.length,
              searchTime
            })
          }
        }
      }

      const provider = ProviderFactory.createProvider(providerConfig)

      // Build messages
      // Exclude the current user message from previous messages (we'll add it with enhanced content)
      const previousMessages = session.messages.filter(m => m.id !== userMessage.id)

      let messages: Array<{ role: "user" | "assistant" | "system"; content: string; images?: ImageAttachment[] }> = []

      // Combine system prompts and add as first message
      // Include user-defined systemPrompt if provided
      const sessionPersonaPrompt = session.personaPrompt || ''
      const sessionPersonaEnabled = session.personaEnabled || false

      let baseSystemPrompt = DEFAULT_SYSTEM_PROMPT

      if (systemPrompt?.trim()) {
      baseSystemPrompt = systemPrompt.trim()
      } else if (session.systemPrompt?.trim()) {
        baseSystemPrompt = session.systemPrompt.trim()
      }
      const combinedSystemPrompt = combineSystemPrompts(
        baseSystemPrompt,
        sessionPersonaPrompt,
        sessionPersonaEnabled
      )


      // Debug logging for persona
      if (isPersonaDebugEnabled()) {
        const debugInfo = debugPersonaState(
          session.id,
          session.personaPrompt,
          session.personaEnabled,
          personaPrompt,
          personaEnabled
        )
        logPersonaDebug(debugInfo)
      }

      console.log('[useChatWithTools] Using persona from session:', {
        sessionId: session.id,
        personaEnabled: sessionPersonaEnabled,
        promptLength: sessionPersonaPrompt.length,
        combinedPromptLength: combinedSystemPrompt.length
      })

      // Add system message only if not already present in previous messages
      const hasSystemMessage = previousMessages.some(m => m.role === 'system')
      if (!hasSystemMessage) {
        messages.push({
          role: 'system',
          content: combinedSystemPrompt,
        })
      }

      // Add previous messages (excluding system messages to avoid duplication)
      messages.push(...previousMessages.filter(m => m.role !== 'system').map(m => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
        images: m.images,
      })))

      // Always add current user message with enhanced content (if search was performed, it contains web context)
      console.log('[useChatWithTools] Adding user message')
      console.log('[useChatWithTools] Enhanced content length:', enhancedContent.length)
      console.log('[useChatWithTools] Enhanced content preview:', enhancedContent.substring(0, 500))
      console.log('[useChatWithTools] Search was performed:', searchContext !== null)
      console.log('[useChatWithTools] Images attached:', images?.length || 0)

      messages.push({
        role: userMessage.role,
        content: enhancedContent,
        images: images && images.length > 0 ? images : undefined,
      })

      // First AI response
      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      }

      addMessage(session.id, assistantMessage)

      // Reset streaming content
      streamingContentRef.current = ''
      const chunkQueue: string[] = []
      let isProcessingQueue = false
      let streamingComplete = false
      const streamStartTime = Date.now() // Track streaming start time

      const processQueue = () => {
        if (chunkQueue.length === 0) {
          isProcessingQueue = false
          return
        }

        isProcessingQueue = true
        const chunk = chunkQueue.shift()!
        streamingContentRef.current += chunk
        updateMessage(session.id, assistantMessage.id, streamingContentRef.current)

        let delay = streamingComplete && chunkQueue.length > 20 ? 5 : 20
        setTimeout(processQueue, delay)
      }

      console.log('[useChatWithTools] Sending messages to provider:', messages.length, 'messages')
      console.log('[useChatWithTools] Last message content length:', messages[messages.length - 1]?.content.length)
      console.log('[useChatWithTools] Last message preview:', messages[messages.length - 1]?.content.substring(0, 300))

      await provider.sendMessage(
        {
          model,
          messages,
          stream: true,
          temperature: 0.7,
        },
        (chunk) => {
          chunkQueue.push(chunk)
          if (!isProcessingQueue) {
            processQueue()
          }
        }
      )

      streamingComplete = true

      // Wait for queue to finish
      while (chunkQueue.length > 0 || isProcessingQueue) {
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      // Process AI response through plugins (processIncoming)
      let processedResponse = streamingContentRef.current
      try {
        const messageProcessors = pluginManager.getByType('message-processor')
        for (const processor of messageProcessors) {
          if (processor.metadata.enabled && typeof (processor as any).processIncoming === 'function') {
            const result = await (processor as any).processIncoming(processedResponse)
            if (typeof result === 'string') {
              processedResponse = result
            }
          }
        }
      } catch (error) {
        console.error('[useChatWithTools] Error processing incoming message:', error)
      }

      updateMessage(session.id, assistantMessage.id, processedResponse)

      // Calculate token usage and citation metadata after streaming completes
      try {
        // Calculate streaming duration and tokens per second
        const streamEndTime = Date.now()
        const streamDuration = streamEndTime - streamStartTime

        // Include the assistant's response in the token calculation
        const messagesWithResponse = [
          ...messages,
          {
            role: 'assistant' as const,
            content: processedResponse
          }
        ]

        const tokenUsage = Tokenizer.countMessageTokens(
          messagesWithResponse,
          model,
          providerConfig.type
        )

        // Calculate tokens per second (only for output tokens)
        const tokensPerSecond = streamDuration > 0 
          ? (tokenUsage.outputTokens / (streamDuration / 1000))
          : 0

        // Add streaming metrics to token usage
        const tokenUsageWithMetrics = {
          ...tokenUsage,
          tokensPerSecond: Math.round(tokensPerSecond * 100) / 100, // Round to 2 decimal places
          streamDuration
        }

        // Extract citation metadata from the assistant's response
        const { CitationParser } = await import('../lib/citations/citationParser')
        const citations = CitationParser.parse(processedResponse)
        const citationMetadata = citations.length > 0 ? {
          sourceIds: CitationParser.extractSourceIds(processedResponse),
          citationCount: citations.length
        } : undefined

        // Update assistant message with token usage and citation metadata
        setSessions(prev =>
          prev.map(s =>
            s.id === session.id
              ? {
                ...s,
                messages: s.messages.map(m =>
                  m.id === assistantMessage.id
                    ? {
                      ...m,
                      metadata: {
                        ...m.metadata,
                        tokenUsage: tokenUsageWithMetrics,
                        model,
                        provider: providerConfig.type,
                        citations: citationMetadata
                      }
                    }
                    : m
                )
              }
              : s
          )
        )

        // Also update current session
        setCurrentSession(prev => {
          if (prev?.id === session.id) {
            return {
              ...prev,
              messages: prev.messages.map(m =>
                m.id === assistantMessage.id
                  ? {
                    ...m,
                    metadata: {
                      ...m.metadata,
                      tokenUsage: tokenUsageWithMetrics,
                      model,
                      provider: providerConfig.type,
                      citations: citationMetadata
                    }
                  }
                  : m
              )
            }
          }
          return prev
        })

        console.log('[Token Usage] Calculated tokens:', tokenUsageWithMetrics)
        if (citationMetadata) {
          console.log('[Citations] Extracted citation metadata:', citationMetadata)
        }
      } catch (error) {
        console.warn('[Token Usage] Failed to calculate token usage:', error)
        // Gracefully handle error - token usage will remain undefined
      }

    } catch (error) {
      console.error('Failed to send message:', error)
      const errorMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
      }
      addMessage(session.id, errorMessage)
    } finally {
      setIsGenerating(false)
    }
  }, [currentSession, addMessage, updateMessage, updateSessionTitle, executeToolCalls, autoSearchEnabled])

  const deleteSession = useCallback((sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    if (currentSession?.id === sessionId) {
      setCurrentSession(null)
    }
  }, [currentSession])

  // Get SourceRegistry from the AutoSearchManager's orchestrator
  const getSourceRegistry = useCallback(() => {
    return autoSearchManager.current.getOrchestrator().getSourceRegistry()
  }, [])

  /**
   * Regenerate a specific assistant message
   */
  const regenerateMessage = useCallback(async (
    messageId: string,
    providerConfig: ProviderConfig,
    model: string
  ) => {
    const session = currentSession
    if (!session) return

    // Find the assistant message to regenerate
    const messageIndex = session.messages.findIndex(m => m.id === messageId)
    if (messageIndex === -1) return

    const messageToRegenerate = session.messages[messageIndex]
    if (messageToRegenerate.role !== 'assistant') return

    // Find the previous user message
    let userMessageIndex = messageIndex - 1
    while (userMessageIndex >= 0 && session.messages[userMessageIndex].role !== 'user') {
      userMessageIndex--
    }

    if (userMessageIndex < 0) return

    const userMessage = session.messages[userMessageIndex]

    // Remove the assistant message and all messages after it
    const messagesBeforeAssistant = session.messages.slice(0, messageIndex)
    
    // Update session with messages up to (but not including) the assistant message
    setSessions(prev =>
      prev.map(s =>
        s.id === session.id
          ? { ...s, messages: messagesBeforeAssistant, updatedAt: Date.now() }
          : s
      )
    )
    setCurrentSession(prev =>
      prev?.id === session.id
        ? { ...prev, messages: messagesBeforeAssistant, updatedAt: Date.now() }
        : prev
    )

    // Create a temporary session with the truncated messages for regeneration
    const tempSession: ChatSession = {
      ...session,
      messages: messagesBeforeAssistant
    }

    // Regenerate by sending the user message again
    await sendMessage(
      userMessage.content,
      providerConfig,
      model,
      tempSession,
      userMessage.images
    )
  }, [currentSession, sendMessage, setSessions, setCurrentSession])

  return {
    sessions,
    currentSession,
    setCurrentSession,
    isGenerating,
    autoSearchEnabled,
    setAutoSearchEnabled,
    webSearchSettings,
    updateWebSearchSettings,
    createSession,
    sendMessage,
    regenerateMessage,
    deleteSession,
    updateSessionTitle,
    personaPrompt,
    personaEnabled,
    updatePersona,
    getSourceRegistry,
  }
}
