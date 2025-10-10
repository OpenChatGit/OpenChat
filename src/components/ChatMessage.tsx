import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { ReasoningBlock } from '../plugins/core/reasoning-detector'
import type { Message } from '../types'
import type { RendererPlugin, ReasoningDetectorPlugin, UIExtensionPlugin } from '../plugins/types'

interface ChatMessageProps {
  message: Message
  rendererPlugins?: RendererPlugin[]
  reasoningDetector?: ReasoningDetectorPlugin
  uiExtensions?: UIExtensionPlugin[]
}

export function ChatMessage({ message, rendererPlugins = [], reasoningDetector, uiExtensions = [] }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const [isCopied, setIsCopied] = useState(false)

  // Try to find a renderer plugin that can handle this content
  const renderer = rendererPlugins.find(plugin => plugin.canRender(message.content))
  
  // Use reasoning detector plugin if available, otherwise return as text
  const parseReasoning = (content: string) => {
    if (reasoningDetector) {
      return reasoningDetector.parseReasoning(content)
    }
    // Fallback: no reasoning detection
    return [{ type: 'text', content }]
  }

  if (isUser) {
    // User message - right aligned with gray bubble
    // Get UI extensions for user message footer
    const userFooterExtensions = uiExtensions.filter(ext => ext.location === 'user-message-footer')

    return (
      <div className="px-4 py-3">
        <div className="max-w-3xl mx-auto flex flex-col items-end gap-1">
          <div 
            className="max-w-[70%] rounded-3xl px-5 py-3"
            style={{ backgroundColor: '#2F2F2F' }}
          >
            <div className="text-sm whitespace-pre-wrap break-words" style={{ color: 'var(--color-foreground)' }}>
              {message.content}
            </div>
          </div>
          {/* Render UI extensions for user message footer */}
          {userFooterExtensions.map((extension) => {
            const Component = extension.component
            return <Component key={extension.metadata.id} message={message} />
          })}
        </div>
      </div>
    )
  }

  // AI message - left aligned, plain text, full width
  return (
    <div className="px-4 py-6 group">
      <div className="max-w-3xl mx-auto">
        <div className="prose prose-invert max-w-none mb-2">
          {(() => {
            // Check for any reasoning tag (case-insensitive)
            const hasReasoningTag = message.content && (
              /<(reasoning|think)>/i.test(message.content)
            )
            
            // If no content yet, show "Reasoning..." indicator
            if (!message.content) {
              return (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                  <span>Reasoning...</span>
                </div>
              )
            }
            
            const parts = parseReasoning(message.content)
            
            // Debug
            console.log('Parsed parts:', parts.length, parts.map(p => ({ type: p.type, length: p.content.length })))
            
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
                    // Check if reasoning is complete (has closing tag OR has text content after it)
                    const isComplete = /<\/(reasoning|think)>/i.test(message.content) || 
                                      (index < parts.length - 1 && parts[index + 1].type === 'text')
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
                      className="text-base leading-relaxed space-y-4"
                      style={{ 
                        color: 'var(--color-foreground)',
                        lineHeight: '1.75'
                      }}
                    >
                      {textContent.split('\n').filter(l => l.trim()).map((line, i) => (
                        <p key={i}>
                          {line}
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
                // Remove all reasoning blocks from content before copying (case-insensitive)
                const contentWithoutReasoning = message.content
                  .replace(/<(reasoning|think)>[\s\S]*?<\/(reasoning|think)>/gi, '')
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
