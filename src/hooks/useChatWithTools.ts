// Enhanced useChat hook with Tool Call support

import { useState, useCallback, useRef } from 'react'
import type { ChatSession, Message, ProviderConfig } from '../types'
import type { ToolCall, ToolCallResult } from '../types/tools'
import { ProviderFactory } from '../providers'
import { generateId } from '../lib/utils'
import { ToolExecutor } from '../lib/toolExecutor'
import { generateSystemPrompt, parseToolCalls, createToolResultMessage } from '../lib/systemPrompts'
import type { PluginManager } from '../plugins/PluginManager'

export function useChatWithTools(pluginManager: PluginManager) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const streamingContentRef = useRef<string>('')
  const toolExecutor = useRef(new ToolExecutor(pluginManager))

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
      const resultMessage: Message = {
        id: generateId(),
        role: 'system',
        content: createToolResultMessage(result.toolCallId, result.result, result.error),
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
      const provider = ProviderFactory.createProvider(providerConfig)
      
      // Get available tools if web search is enabled
      const availableTools = webSearchEnabled ? toolExecutor.current.getAvailableTools() : []
      
      // Build messages with system prompt
      const previousMessages = session.messages.filter(m => m.id !== userMessage.id || hasUserMessage)
      
      let messages: Array<{ role: string; content: string }> = []
      
      // Add system prompt with tools if enabled
      if (availableTools.length > 0) {
        messages.push({
          role: 'system',
          content: generateSystemPrompt(availableTools),
        })
      }
      
      // Add conversation history
      messages = messages.concat(
        previousMessages.map(m => ({
          role: m.role,
          content: m.content,
        }))
      )
      
      // Add current user message if not already included
      if (!hasUserMessage) {
        messages.push({
          role: userMessage.role,
          content: userMessage.content,
        })
      }

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

      // Check if response contains tool calls
      const toolCalls = parseToolCalls(streamingContentRef.current)
      
      if (toolCalls && toolCalls.length > 0 && webSearchEnabled) {
        console.log('Tool calls detected:', toolCalls)
        
        // Execute tool calls
        await executeToolCalls(toolCalls, session.id)
        
        // Get updated session with tool results
        const updatedSession = sessions.find(s => s.id === session.id) || session
        
        // Build new messages array with tool results
        const messagesWithResults = updatedSession.messages.map(m => ({
          role: m.role,
          content: m.content,
        }))
        
        // Second AI response with tool results
        const finalMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
        }
        
        addMessage(session.id, finalMessage)
        
        streamingContentRef.current = ''
        const finalQueue: string[] = []
        let isFinalProcessing = false
        let finalComplete = false
        
        const processFinalQueue = () => {
          if (finalQueue.length === 0) {
            isFinalProcessing = false
            return
          }
          
          isFinalProcessing = true
          const chunk = finalQueue.shift()!
          streamingContentRef.current += chunk
          updateMessage(session.id, finalMessage.id, streamingContentRef.current)
          
          let delay = finalComplete && finalQueue.length > 20 ? 5 : 20
          setTimeout(processFinalQueue, delay)
        }
        
        await provider.sendMessage(
          {
            model,
            messages: messagesWithResults,
            stream: true,
            temperature: 0.7,
          },
          (chunk) => {
            finalQueue.push(chunk)
            if (!isFinalProcessing) {
              processFinalQueue()
            }
          }
        )
        
        finalComplete = true
        
        while (finalQueue.length > 0 || isFinalProcessing) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
        
        updateMessage(session.id, finalMessage.id, streamingContentRef.current)
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
  }, [currentSession, addMessage, updateMessage, updateSessionTitle, webSearchEnabled, executeToolCalls, sessions])

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
