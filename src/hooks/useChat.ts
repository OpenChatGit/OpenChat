import { useState, useCallback, useRef, useEffect } from 'react'
import type { ChatSession, Message, ProviderConfig } from '../types'
import { ProviderFactory } from '../providers'
import { generateId, loadLocal, saveLocal, retry } from '../lib/utils'
import { performWebSearch } from '../lib/webSearchHelper'

export function useChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const streamingContentRef = useRef<string>('')
  const mountedRef = useRef<boolean>(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const queueTimerRef = useRef<number | null>(null)
  const userCancelledRef = useRef<boolean>(false)
  const cancelStreamingRef = useRef<boolean>(false)

  // Load persisted state on mount
  useEffect(() => {
    mountedRef.current = true
    try {
      const persistedSessions = loadLocal<ChatSession[]>('oc.sessions', [])
      const persistedCurrentId = loadLocal<string | null>('oc.currentSessionId', null)
      const persistedWebSearch = loadLocal<boolean>('oc.webSearchEnabled', false)

      if (persistedSessions && Array.isArray(persistedSessions) && persistedSessions.length > 0) {
        setSessions(persistedSessions)
        if (persistedCurrentId) {
          const found = persistedSessions.find(s => s.id === persistedCurrentId) || null
          setCurrentSession(found)
        }
      }
      if (typeof persistedWebSearch === 'boolean') {
        setWebSearchEnabled(persistedWebSearch)
      }
    } catch {
      // ignore and start fresh
    }
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Persist sessions
  useEffect(() => {
    saveLocal('oc.sessions', sessions)
  }, [sessions])

  // Persist current session id
  useEffect(() => {
    saveLocal<string | null>('oc.currentSessionId', currentSession?.id ?? null)
  }, [currentSession])

  // Persist web search toggle
  useEffect(() => {
    saveLocal('oc.webSearchEnabled', webSearchEnabled)
  }, [webSearchEnabled])

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
    // Update sessions
    setSessions(prev =>
      prev.map(s =>
        s.id === sessionId
          ? { ...s, messages: [...s.messages, message], updatedAt: Date.now() }
          : s
      )
    )
    
    // Always update currentSession if it matches, regardless of currentSession state
    setCurrentSession(prev => {
      if (prev?.id === sessionId) {
        return { ...prev, messages: [...prev.messages, message], updatedAt: Date.now() }
      }
      return prev
    })
  }, [])

  const updateMessage = useCallback((sessionId: string, messageId: string, content: string) => {
    // Update sessions
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
    
    // Update currentSession separately to trigger re-render
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

  const setMessageStatus = useCallback((sessionId: string, messageId: string, status: Message['status']) => {
    setSessions(prev =>
      prev.map(s =>
        s.id === sessionId
          ? {
              ...s,
              messages: s.messages.map(m =>
                m.id === messageId ? { ...m, status } : m
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
          messages: prev.messages.map(m => (m.id === messageId ? { ...m, status } : m)),
          updatedAt: Date.now(),
        }
      }
      return prev
    })
  }, [])

  const removeMessageById = useCallback((sessionId: string, messageId: string) => {
    setSessions(prev =>
      prev.map(s =>
        s.id === sessionId
          ? { ...s, messages: s.messages.filter(m => m.id !== messageId) }
          : s
      )
    )
    setCurrentSession(prev => {
      if (prev?.id === sessionId) {
        return { ...prev, messages: prev.messages.filter(m => m.id !== messageId) }
      }
      return prev
    })
  }, [])

  // Helper: push a transient status message (e.g., 'searching')
  const addStatusMessage = useCallback((sessionId: string, status: Message['status']): Message => {
    const msg: Message = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status,
    }
    addMessage(sessionId, msg)
    return msg
  }, [addMessage])

  const sendMessage = useCallback(async (
    content: string,
    providerConfig: ProviderConfig,
    model: string,
    targetSession?: ChatSession,
    existingUserMessageId?: string
  ) => {
    // Cancel any ongoing generation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    if (queueTimerRef.current) {
      clearTimeout(queueTimerRef.current)
      queueTimerRef.current = null
    }
    cancelStreamingRef.current = false

    const session = targetSession || currentSession
    if (!session) return
    
    console.log('📤 Sending message:', {
      content: content.slice(0, 50) + '...',
      webSearchEnabled,
    })

    // Robust de-dup: reuse the existing initial user message if provided
    let userMessage: Message
    if (existingUserMessageId) {
      const found = session.messages.find(m => m.id === existingUserMessageId && m.role === 'user')
      if (found) {
        userMessage = found
      } else {
        userMessage = {
          id: existingUserMessageId,
          role: 'user',
          content,
          timestamp: Date.now(),
        }
        addMessage(session.id, userMessage)
      }
    } else {
      userMessage = {
        id: generateId(),
        role: 'user',
        content,
        timestamp: Date.now(),
      }
      addMessage(session.id, userMessage)
    }

    // Auto-generate title from first message
    const isFirstMessage =
      session.messages.length === 0 ||
      (existingUserMessageId !== undefined && session.messages.length === 1)
    if (isFirstMessage) {
      const title = content.slice(0, 50) + (content.length > 50 ? '...' : '')
      updateSessionTitle(session.id, title)
    }

    // Perform web search if enabled (with guaranteed cleanup)
    let searchingMessage: Message | null = null
    let webSearchContext: string | null = null
    if (webSearchEnabled) {
      console.log('🌐 Web Search is ENABLED')
      searchingMessage = addStatusMessage(session.id, 'searching')
      console.log('⏳ Calling performWebSearch...')
      try {
        webSearchContext = await performWebSearch(content, webSearchEnabled)
        console.log('✅ performWebSearch returned:', webSearchContext ? 'Context available' : 'No context')
      } finally {
        if (searchingMessage) {
          updateMessage(session.id, searchingMessage.id, '')
          removeMessageById(session.id, searchingMessage.id)
        }
      }
    }

    const assistantMessage: Message = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isReasoning: undefined,
    }

    addMessage(session.id, assistantMessage)
    setIsGenerating(true)

    // Prepare abort controller for this request
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const provider = ProviderFactory.createProvider(providerConfig)
      
      // Build messages array for API call - include ALL previous messages for context
      // Get all messages except the empty assistant message we just added
      const previousMessages = session.messages.filter(m => m.id !== assistantMessage.id)
      
      // Add the current user message if it's not already in the session
      const hasCurrentUserMessage = previousMessages.some(m => m.id === userMessage.id)
      const allMessages = hasCurrentUserMessage 
        ? previousMessages 
        : [...previousMessages, userMessage]

      // Build base messages without forcing date unless needed
      let messages = [
        ...allMessages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      ]
      
      // Add web search context as system message if available
      if (webSearchContext) {
        console.log('📦 Adding web search context to messages')
        console.log('📏 Context length:', webSearchContext.length, 'characters')
        messages = [
          {
            role: 'system',
            content: `You have access to the following web search results. Use this information to answer the user's question accurately and cite your sources.

${webSearchContext}

IMPORTANT: Always cite the sources from the web search results in your answer.`,
          },
          ...messages,
        ]
        console.log('✅ Messages array now has', messages.length, 'messages')
        console.log('📨 First message is system message with web search context')
      } else {
        // Add date reminder ONLY when the user explicitly asks for date/time
        const contentLower = content.toLowerCase()
        const isDateQuery = (
          /(?:what(?:'s| is)|which|tell me|give me|please|wie|welches|welcher|welchem|wieviel|wie viel|wie spät).*\b(?:date|datum|time|uhrzeit|day|tag)\b/.test(contentLower) ||
          /today'?s\s+date|aktuelles\s+datum/.test(contentLower)
        )
        if (isDateQuery) {
          const todayIso = new Date().toISOString().split('T')[0]
          messages = [
            {
              role: 'system' as const,
              content: `Today's date is ${todayIso}. Use this only to answer the user's explicit question about date/time; otherwise do not mention it.`,
            },
            ...messages,
          ]
        }
      }
      // Reset streaming content
      streamingContentRef.current = ''
      const chunkQueue: string[] = []
      let isProcessingQueue = false
      let chunkCount = 0
      let streamingComplete = false
      
      // Process queue with adaptive typewriter effect
      const processQueue = () => {
        if (chunkQueue.length === 0) {
          isProcessingQueue = false
          return
        }
        if (cancelStreamingRef.current) {
          // Flush and stop immediately
          chunkQueue.length = 0
          isProcessingQueue = false
          return
        }
        
        isProcessingQueue = true
        const chunk = chunkQueue.shift()!
        streamingContentRef.current += chunk
        updateMessage(session.id, assistantMessage.id, streamingContentRef.current)
        
        // Adaptive delay based on queue size
        let delay = 0
        if (chunkCount < 10) {
          // First 10 chunks: immediate
          delay = 0
        } else if (streamingComplete && chunkQueue.length > 20) {
          // Streaming done + large queue: speed up dramatically
          delay = 5
        } else if (chunkQueue.length > 10) {
          // Large queue: reduce delay
          delay = 10
        } else {
          // Normal typewriter speed
          delay = 20
        }
        
        chunkCount++
        queueTimerRef.current = window.setTimeout(processQueue, delay) as unknown as number
      }
      
      await retry(
        () => provider.sendMessage(
          {
            model,
            messages,
            stream: true,
            temperature: 0.7,
          },
          (chunk) => {
            // Add chunk to queue
            chunkQueue.push(chunk)
            
            // Start processing if not already running
            if (!isProcessingQueue) {
              processQueue()
            }
          },
          controller.signal
        ),
        {
          retries: 2,
          initialDelayMs: 500,
          factor: 2,
          shouldRetry: (e) => {
            if ((e as any)?.name === 'AbortError') return false
            const msg = (e as Error)?.message || ''
            return /timeout|ECONNREFUSED|Failed to fetch|NetworkError|5\d\d/.test(msg)
          }
        }
      )
      
      // Mark streaming as complete
      streamingComplete = true
      
      // Wait for queue to finish
      while (chunkQueue.length > 0 || isProcessingQueue) {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      
      // Final update to ensure all content is shown
      updateMessage(session.id, assistantMessage.id, streamingContentRef.current)
    } catch (error) {
      if ((error as any)?.name === 'AbortError') {
        // Close any open <think> block and mark as cancelled
        let finalContent = streamingContentRef.current
        if (finalContent && finalContent.includes('<think>') && !finalContent.includes('</think>')) {
          finalContent += '</think>'
        }
        if (finalContent) {
          updateMessage(session.id, assistantMessage.id, finalContent)
        }
        setMessageStatus(session.id, assistantMessage.id, 'cancelled')
      } else {
        console.error('Failed to send message:', error)
        updateMessage(
          session.id,
          assistantMessage.id,
          `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    } finally {
      if (queueTimerRef.current) {
        clearTimeout(queueTimerRef.current)
        queueTimerRef.current = null
      }
      cancelStreamingRef.current = false
      abortControllerRef.current = null
      userCancelledRef.current = false
      setIsGenerating(false)
    }
  }, [currentSession, addMessage, updateMessage, updateSessionTitle, webSearchEnabled, setSessions, setCurrentSession, removeMessageById])

  // Note: stop generation feature temporarily disabled per user request

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
    webSearchEnabled,
    setWebSearchEnabled,
    createSession,
    sendMessage,
    deleteSession,
    updateSessionTitle,
  }
}
