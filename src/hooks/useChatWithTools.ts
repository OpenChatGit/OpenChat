// Enhanced useChat hook with Tool Call support

import { useState, useCallback, useRef, useEffect } from 'react'
import type { ChatSession, Message, ProviderConfig } from '../types'
import type { ToolCall, ToolCallResult } from '../types/tools'
import { ProviderFactory } from '../providers'
import { generateId } from '../lib/utils'
import { ToolExecutor } from '../lib/toolExecutor'
import type { PluginManager } from '../plugins/core'
import { AutoSearchManager } from '../lib/web-search/autoSearchManager'
import type { SearchContext } from '../lib/web-search/types'
import type { WebSearchSettings } from '../components/WebSearchSettings'
import { loadWebSearchSettings, saveWebSearchSettings } from '../lib/web-search/settingsStorage'

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
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(() => {
    try {
      const saved = localStorage.getItem('current-session')
      return saved ? JSON.parse(saved) : null
    } catch (error) {
      console.error('Failed to load current session from localStorage:', error)
      return null
    }
  })
  
  const [isGenerating, setIsGenerating] = useState(false)
  const [autoSearchEnabled, setAutoSearchEnabled] = useState(false)
  const [webSearchSettings, setWebSearchSettings] = useState<WebSearchSettings | null>(null)
  const streamingContentRef = useRef<string>('')
  const toolExecutor = useRef(new ToolExecutor(pluginManager))
  const autoSearchManager = useRef(new AutoSearchManager())
  const settingsInitialized = useRef(false)

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('chat-sessions', JSON.stringify(sessions))
    } catch (error) {
      console.error('Failed to save sessions to localStorage:', error)
    }
  }, [sessions])

  // Save current session to localStorage whenever it changes
  useEffect(() => {
    try {
      if (currentSession) {
        localStorage.setItem('current-session', JSON.stringify(currentSession))
      } else {
        localStorage.removeItem('current-session')
      }
    } catch (error) {
      console.error('Failed to save current session to localStorage:', error)
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
    }

    setSessions(prev => [newSession, ...prev])
    setCurrentSession(newSession)
    return newSession
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
   * Send message with tool support
   */
  const sendMessage = useCallback(async (
    content: string,
    providerConfig: ProviderConfig,
    model: string,
    targetSession?: ChatSession
  ) => {
    const session = targetSession || currentSession
    if (!session) return

    // Check if user message already exists
    const hasUserMessage = session.messages.some(m => m.role === 'user' && m.content === content)
    
    let userMessage: Message
    
    if (!hasUserMessage) {
      userMessage = {
        id: generateId(),
        role: 'user',
        content,
        timestamp: Date.now(),
        metadata: {}
      }
      addMessage(session.id, userMessage)
    } else {
      userMessage = session.messages.find(m => m.role === 'user' && m.content === content)!
    }

    // Auto-generate title from first message
    const isFirstMessage = session.messages.length === 0 || (session.messages.length === 1 && hasUserMessage)
    if (isFirstMessage) {
      const title = content.slice(0, 50) + (content.length > 50 ? '...' : '')
      updateSessionTitle(session.id, title)
    }

    setIsGenerating(true)

    try {
      // Configure AutoSearchManager with current state
      autoSearchManager.current.configure({ enabled: autoSearchEnabled })

      // Check if auto-search should be triggered
      let enhancedContent = content
      let searchContext: SearchContext | null = null

      if (autoSearchEnabled) {
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
      
      let messages: Array<{ role: "user" | "assistant" | "system"; content: string }> = previousMessages.map(m => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }))
      
      // Always add current user message with enhanced content (if search was performed, it contains web context)
      console.log('[useChatWithTools] Adding user message')
      console.log('[useChatWithTools] Enhanced content length:', enhancedContent.length)
      console.log('[useChatWithTools] Enhanced content preview:', enhancedContent.substring(0, 500))
      console.log('[useChatWithTools] Search was performed:', searchContext !== null)
      
      messages.push({
        role: userMessage.role,
        content: enhancedContent,
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
      
      updateMessage(session.id, assistantMessage.id, streamingContentRef.current)
      
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
    deleteSession,
    updateSessionTitle,
  }
}
