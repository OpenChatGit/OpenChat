import { useState, useEffect } from 'react'
import type { Message } from '../types'
import type { RendererPlugin } from '../plugins/core'
import { ReasoningBlock } from './ReasoningBlock'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck } from '@fortawesome/free-solid-svg-icons'

interface ChatMessageProps {
  message: Message
  rendererPlugins?: RendererPlugin[]
  previousMessage?: Message // To access autoSearch metadata from previous user message
}

export function ChatMessage({ message, rendererPlugins = [], previousMessage }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const [isCopied, setIsCopied] = useState(false)
  
  // Debounce content rendering during streaming
  const [debouncedContent, setDebouncedContent] = useState(message.content)
  
  useEffect(() => {
    // If streaming, debounce updates by 150ms
    if (message.isStreaming) {
      const timer = setTimeout(() => {
        setDebouncedContent(message.content)
      }, 150)
      
      return () => clearTimeout(timer)
    } else {
      // If not streaming, update immediately
      setDebouncedContent(message.content)
    }
  }, [message.content, message.isStreaming])

  // Use debounced content during streaming, actual content when complete
  const contentToRender = message.isStreaming ? debouncedContent : message.content
  
  // Try to find a renderer plugin that can handle this content
  const renderer = rendererPlugins.find(plugin => plugin.canRender(contentToRender))
  
  // Parse reasoning blocks from AI messages
  const parseReasoning = (content: string) => {
    // Normalize alternative reasoning markers to <think> tags for a single parser path
    let text = content
      .replace(/<thinking>/gi, '<think>')
      .replace(/<\/thinking>/gi, '</think>')
      .replace(/<reasoning>/gi, '<think>')
      .replace(/<\/reasoning>/gi, '</think>')
      // Convert fenced code blocks ```reasoning to <think> blocks
      // First, replace ```reasoning blocks with <think>...</think>
      .replace(/```reasoning\s*([\s\S]*?)```/gi, '<think>$1</think>')
      // Then handle incomplete ```reasoning blocks (during streaming)
      .replace(/```reasoning\s*([\s\S]*?)$/gi, '<think>$1')

    // Check if content has <think> tags
    if (!text.includes('<think>')) {
      return [{ type: 'text', content: text }]
    }
    
    const parts: Array<{ type: string; content: string }> = []
    
    // Handle incomplete reasoning (during streaming)
    if (text.includes('<think>') && !text.includes('</think>')) {
      const thinkIndex = text.indexOf('<think>')
      // Add text before <think> if any
      if (thinkIndex > 0) {
        const beforeText = text.slice(0, thinkIndex).trim()
        if (beforeText) {
          parts.push({ type: 'text', content: beforeText })
        }
      }
      // Add incomplete reasoning content (everything after <think>)
      const reasoningContent = text.slice(thinkIndex + 7).trim() // +7 for '<think>'
      if (reasoningContent) {
        parts.push({ type: 'reasoning', content: reasoningContent })
      }
      return parts.length > 0 ? parts : []
    }
    
    // Handle complete reasoning blocks
    const thinkRegex = /<think>([\s\S]*?)<\/think>/g
    let match
    let lastIndex = 0
    
    while ((match = thinkRegex.exec(text)) !== null) {
      // Add text before <think>
      if (match.index > lastIndex) {
        const beforeText = text.slice(lastIndex, match.index).trim()
        if (beforeText) {
          parts.push({ type: 'text', content: beforeText })
        }
      }
      // Add reasoning block
      const reasoningContent = match[1].trim()
      if (reasoningContent) {
        parts.push({ type: 'reasoning', content: reasoningContent })
      }
      lastIndex = match.index + match[0].length
    }
    
    // Add remaining text after last </think>
    if (lastIndex < text.length) {
      const remainingText = text.slice(lastIndex).trim()
      if (remainingText) {
        parts.push({ type: 'text', content: remainingText })
      }
    }
    
    return parts.length > 0 ? parts : []
  }

  if (isUser) {
    // User message - right aligned with gray bubble
    return (
      <div className="px-4 py-3">
        <div className="max-w-3xl mx-auto flex justify-end">
          <div 
            className="max-w-[70%] rounded-3xl px-5 py-3"
            style={{ backgroundColor: '#2F2F2F' }}
          >
            <div className="text-sm whitespace-pre-wrap break-words" style={{ color: 'var(--color-foreground)' }}>
              {message.content}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Handle system messages with searching status - only show indicator
  if (message.role === 'system' && message.status === 'searching') {
    return (
      <div className="px-4 py-2">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Searching web</span>
          </div>
        </div>
      </div>
    )
  }

  // AI message - left aligned, plain text, full width
  // Reduced top padding to bring it closer to web search indicator
  const hasAutoSearch = previousMessage?.metadata?.autoSearch?.triggered
  const searchSources = previousMessage?.metadata?.autoSearch?.sources || []
  const hasCompletedSearch = hasAutoSearch && searchSources.length > 0
  
  return (
    <div className="px-4 py-1 group">
      <div className="max-w-3xl mx-auto" style={{ minHeight: '2rem' }}>
        {/* Searched Web Indicator - only show after search completes */}
        {hasCompletedSearch && (
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>Searched Web</span>
            <div className="flex items-center gap-1">
              {searchSources.slice(0, 5).map((source: any, idx: number) => (
                <img
                  key={idx}
                  src={`https://www.google.com/s2/favicons?domain=${source.url}&sz=16`}
                  alt={source.title}
                  className="w-4 h-4 rounded-sm opacity-70"
                  title={source.title}
                />
              ))}
            </div>
          </div>
        )}
        
        <div className="prose prose-invert max-w-none mb-1">
          {(() => {
            if (message.status === 'cancelled') {
              return (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <span>Generation cancelled</span>
                </div>
              )
            }
            const hasReasoningTag = contentToRender && /<(think|thinking|reasoning)>|```reasoning/i.test(contentToRender)
            
            // If no content yet, show "Reasoning..." indicator
            if (!contentToRender) {
              return (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                  <span>Reasoning...</span>
                </div>
              )
            }
            
            const parts = parseReasoning(contentToRender)
            
            // If parsing returns empty but we have content starting with <think>, show reasoning indicator
            if (parts.length === 0 && hasReasoningTag) {
              return (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                  <span>Reasoning...</span>
                </div>
              )
            }
            
            // If no parts and no reasoning tag, show generating
            if (parts.length === 0) {
              return (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                  <span>Generating...</span>
                </div>
              )
            }
            
            return (
              <>
                {parts.map((part, index) => {
                  if (part.type === 'reasoning') {
                    // Check if reasoning is complete (has closing tag)
                    const isComplete = /<\/(think|thinking|reasoning)>|```/i.test(contentToRender)
                    return <ReasoningBlock key={index} content={part.content} isComplete={isComplete} />
                  }
                  
                  // Regular text content
                  const textContent = part.content.trim()
                  if (!textContent) return null
                  
                  return renderer ? (
                    <div key={index} className="markdown-content">{renderer.render(textContent)}</div>
                  ) : (
                    <div 
                      key={index} 
                      className="text-base leading-relaxed"
                      style={{ 
                        color: 'var(--color-foreground)',
                        lineHeight: '1.75'
                      }}
                    >
                      {textContent.split('\n').map((line, i) => (
                        <p key={i} className={i > 0 ? 'mt-4' : ''}>
                          {line || '\u00A0'}
                        </p>
                      ))}
                    </div>
                  )
                })}
              </>
            )
          })()}
        </div>
        
        {/* Action Buttons - only show on hover */}
        {message.content && (
          <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Copy Button */}
            <button
              onClick={() => {
                // Remove <think>...</think> blocks from content before copying
                const contentWithoutReasoning = message.content
                  .replace(/<think>[\s\S]*?<\/think>/gi, '')
                  .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
                  .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
                  .replace(/```reasoning[\s\S]*?```/gi, '')
                  .trim()
                navigator.clipboard.writeText(contentWithoutReasoning)
                
                // Show checkmark animation
                setIsCopied(true)
                setTimeout(() => setIsCopied(false), 2000) // Reset after 2 seconds
              }}
              className="p-1.5 rounded hover:bg-white/10 transition-colors flex items-center justify-center"
              style={{ width: '28px', height: '28px' }}
              title={isCopied ? "Copied!" : "Copy"}
            >
              {isCopied ? (
                <FontAwesomeIcon icon={faCheck} style={{ width: '16px', height: '16px', color: 'currentColor' }} />
              ) : (
                <img src="/src/assets/content_copy.svg" alt="Copy" className="w-4 h-4" />
              )}
            </button>
            
            {/* Info Button */}
            <button
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              title="Info"
            >
              <img src="/src/assets/info_icon.svg" alt="Info" className="w-4 h-4" />
            </button>
            
            {/* Refresh Button */}
            <button
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              title="Regenerate"
            >
              <img src="/src/assets/refresh.svg" alt="Refresh" className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
