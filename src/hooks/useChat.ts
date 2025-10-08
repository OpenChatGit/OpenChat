import { useState, useCallback, useRef } from 'react'
import type { ChatSession, Message, ProviderConfig } from '../types'
import { ProviderFactory } from '../providers'
import { generateId } from '../lib/utils'
import { performWebSearch } from '../lib/webSearchHelper'

export function useChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const streamingContentRef = useRef<string>('')

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

  const sendMessage = useCallback(async (
    content: string,
    providerConfig: ProviderConfig,
    model: string,
    targetSession?: ChatSession
  ) => {
    const session = targetSession || currentSession
    if (!session) return
    
    console.log('📤 Sending message:', {
      content: content.slice(0, 50) + '...',
      webSearchEnabled,
    })

    // Check if user message already exists (when creating new session with initial message)
    const hasUserMessage = session.messages.some(m => m.role === 'user' && m.content === content)
    
    let userMessage: Message
    
    if (!hasUserMessage) {
      userMessage = {
        id: generateId(),
        role: 'user',
        content,
        timestamp: Date.now(),
      }
      addMessage(session.id, userMessage)
    } else {
      // Use existing message
      userMessage = session.messages.find(m => m.role === 'user' && m.content === content)!
    }

    // Auto-generate title from first message
    const isFirstMessage = session.messages.length === 0 || (session.messages.length === 1 && hasUserMessage)
    if (isFirstMessage) {
      const title = content.slice(0, 50) + (content.length > 50 ? '...' : '')
      updateSessionTitle(session.id, title)
    }

    // Show searching indicator if web search might be needed
    const searchingMessage: Message = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'searching',
    }

    // Perform web search if enabled
    let webSearchContext: string | null = null
    if (webSearchEnabled) {
      console.log('🌐 Web Search is ENABLED')
      addMessage(session.id, searchingMessage)
      console.log('⏳ Calling performWebSearch...')
      webSearchContext = await performWebSearch(content, webSearchEnabled)
      console.log('✅ performWebSearch returned:', webSearchContext ? 'Context available' : 'No context')
      
      // Remove searching indicator
      if (webSearchContext) {
        updateMessage(session.id, searchingMessage.id, '')
        setSessions(prev =>
          prev.map(s =>
            s.id === session.id
              ? {
                  ...s,
                  messages: s.messages.filter(m => m.id !== searchingMessage.id),
                }
              : s
          )
        )
        setCurrentSession(prev => {
          if (prev?.id === session.id) {
            return {
              ...prev,
              messages: prev.messages.filter(m => m.id !== searchingMessage.id),
            }
          }
          return prev
        })
      } else {
        // No search needed, remove indicator
        updateMessage(session.id, searchingMessage.id, '')
        setSessions(prev =>
          prev.map(s =>
            s.id === session.id
              ? {
                  ...s,
                  messages: s.messages.filter(m => m.id !== searchingMessage.id),
                }
              : s
          )
        )
        setCurrentSession(prev => {
          if (prev?.id === session.id) {
            return {
              ...prev,
              messages: prev.messages.filter(m => m.id !== searchingMessage.id),
            }
          }
          return prev
        })
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

      const todayIso = new Date().toISOString().split('T')[0]
      const systemReminder = {
        role: 'system' as const,
        content: [
          `Today's date is ${todayIso}.`,
          'Treat the aggregated web search context as the most up-to-date information available.',
          'When multiple independent sources agree, prefer their data over any outdated training knowledge.',
          'If new evidence contradicts prior assumptions, update your answer accordingly and cite the sources.',
        ].join(' '),
      }

      let messages = [
        systemReminder,
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
        console.log('⚠️ No web search context available')
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
        setTimeout(processQueue, delay)
      }
      
      await provider.sendMessage(
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
      console.error('Failed to send message:', error)
      updateMessage(
        session.id,
        assistantMessage.id,
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    } finally {
      setIsGenerating(false)
    }
  }, [currentSession, addMessage, updateMessage, updateSessionTitle, webSearchEnabled, setSessions, setCurrentSession])

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
