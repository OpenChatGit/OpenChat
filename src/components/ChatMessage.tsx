import { useState, useEffect } from 'react'
import type { Message, ImageAttachment } from '../types'
import type { RendererPlugin } from '../plugins/core'
import { ReasoningBlock } from './ReasoningBlock'
import { TokenUsageDropdown } from './TokenUsageDropdown'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faTimes } from '@fortawesome/free-solid-svg-icons'
import contentCopyIcon from '../assets/content_copy.svg'
import infoIcon from '../assets/info_icon.svg'
import refreshIcon from '../assets/refresh.svg'
import { CitationParser } from '../lib/citations/citationParser'
import type { SourceRegistry } from '../lib/web-search/sourceRegistry'
import { PluginHookRenderer } from './PluginHookRenderer'

interface ChatMessageProps {
  message: Message
  rendererPlugins?: RendererPlugin[]
  previousMessage?: Message // To access autoSearch metadata from previous user message
  sourceRegistry?: SourceRegistry // Optional: For rendering citations
}

export function ChatMessage({ message, rendererPlugins = [], previousMessage, sourceRegistry }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const [isCopied, setIsCopied] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<ImageAttachment | null>(null)
  const [imageLoadStates, setImageLoadStates] = useState<Record<string, 'loading' | 'loaded' | 'error'>>({})
  const [isTokenDropdownOpen, setIsTokenDropdownOpen] = useState(false)
  
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

  // Render content with citations
  const renderContentWithCitations = (content: string, renderer?: RendererPlugin) => {
    // If no sourceRegistry, render normally without citations
    if (!sourceRegistry) {
      return renderer ? renderer.render(content) : (
        <div 
          className="text-base leading-relaxed"
          style={{ 
            color: 'var(--color-foreground)',
            lineHeight: '1.75'
          }}
        >
          {content.split('\n').map((line, i) => (
            <p key={i} className={i > 0 ? 'mt-4' : ''}>
              {line || '\u00A0'}
            </p>
          ))}
        </div>
      )
    }

    // Parse citations from content
    const citations = CitationParser.parse(content)
    
    // If no citations found, render normally with full renderer support
    if (citations.length === 0) {
      return renderer ? renderer.render(content) : (
        <div 
          className="text-base leading-relaxed"
          style={{ 
            color: 'var(--color-foreground)',
            lineHeight: '1.75'
          }}
        >
          {content.split('\n').map((line, i) => (
            <p key={i} className={i > 0 ? 'mt-4' : ''}>
              {line || '\u00A0'}
            </p>
          ))}
        </div>
      )
    }

    // Pragmatic solution: Replace citations with simple [1] text
    // They won't be clickable, but markdown will work and they'll be inline
    // Users can click the favicons in "Searched Web" to see sources
    
    let processedContent = content
    
    // Sort citations by startIndex in reverse to maintain indices
    const sortedCitations = [...citations].sort((a, b) => b.startIndex - a.startIndex)
    
    sortedCitations.forEach((citation) => {
      // Replace with simple superscript text
      const replacement = `[${citation.sourceId}]`
      
      processedContent = 
        processedContent.substring(0, citation.startIndex) + 
        replacement + 
        processedContent.substring(citation.endIndex)
    })
    
    // Render with markdown - citations appear as [1], [2] inline
    if (renderer) {
      return renderer.render(processedContent)
    }
    
    // Fallback without renderer
    return (
      <div 
        className="text-base leading-relaxed"
        style={{ 
          color: 'var(--color-foreground)',
          lineHeight: '1.75'
        }}
      >
        {processedContent.split('\n').map((line, i) => (
          <p key={i} className={i > 0 ? 'mt-4' : ''}>
            {line || '\u00A0'}
          </p>
        ))}
      </div>
    )
  }

  // Handle image loading states
  const handleImageLoad = (imageId: string) => {
    setImageLoadStates(prev => ({ ...prev, [imageId]: 'loaded' }))
  }

  const handleImageError = (imageId: string) => {
    setImageLoadStates(prev => ({ ...prev, [imageId]: 'error' }))
  }

  // Initialize loading state for images
  useEffect(() => {
    if (message.images) {
      const initialStates: Record<string, 'loading' | 'loaded' | 'error'> = {}
      message.images.forEach(img => {
        if (!imageLoadStates[img.id]) {
          initialStates[img.id] = 'loading'
        }
      })
      if (Object.keys(initialStates).length > 0) {
        setImageLoadStates(prev => ({ ...prev, ...initialStates }))
      }
    }
  }, [message.images])

  // Handle Escape key to close lightbox
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightboxImage) {
        setLightboxImage(null)
      }
    }

    if (lightboxImage) {
      document.addEventListener('keydown', handleEscape)
      // Trap focus in lightbox
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [lightboxImage])

  // Render images in a responsive grid
  const renderImages = (images: ImageAttachment[]) => {
    if (!images || images.length === 0) return null

    return (
      <div 
        className={`grid gap-2 mb-3 ${
          images.length === 1 ? 'grid-cols-1' : 
          images.length === 2 ? 'grid-cols-2' : 
          images.length === 3 ? 'grid-cols-3' : 
          'grid-cols-2 sm:grid-cols-3'
        }`}
        role="list"
        aria-label={`${images.length} image(s) in message`}
      >
        {images.map((image) => {
          const loadState = imageLoadStates[image.id] || 'loading'
          const imageUrl = image.url || `data:${image.mimeType};base64,${image.data}`

          return (
            <div
              key={image.id}
              className="relative rounded-lg overflow-hidden bg-gray-800 cursor-pointer hover:opacity-90 transition-opacity focus-within:ring-2 focus-within:ring-white"
              style={{ 
                width: images.length === 1 ? '200px' : '120px',
                height: images.length === 1 ? '200px' : '120px'
              }}
              role="listitem"
            >
              <button
                onClick={() => setLightboxImage(image)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setLightboxImage(image)
                  }
                }}
                className="w-full h-full focus:outline-none"
                aria-label={`View full size image: ${image.fileName}`}
              >
                {loadState === 'loading' && (
                  <div className="absolute inset-0 flex items-center justify-center" aria-label="Loading image">
                    <svg className="w-8 h-8 animate-spin text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                )}
                {loadState === 'error' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 text-sm" role="alert">
                    <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Failed to load</span>
                  </div>
                )}
                <img
                  src={imageUrl}
                  alt={`${image.fileName}${image.width && image.height ? `, ${image.width} by ${image.height} pixels` : ''}`}
                  className={`w-full h-full object-cover ${loadState === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
                  onLoad={() => handleImageLoad(image.id)}
                  onError={() => handleImageError(image.id)}
                  loading="lazy"
                />
              </button>
            </div>
          )
        })}
      </div>
    )
  }

  // Lightbox modal for full-size image view
  const renderLightbox = () => {
    if (!lightboxImage) return null

    const imageUrl = lightboxImage.url || `data:${lightboxImage.mimeType};base64,${lightboxImage.data}`

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
        onClick={() => setLightboxImage(null)}
        role="dialog"
        aria-modal="true"
        aria-label="Image viewer"
      >
        <button
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white"
          onClick={() => setLightboxImage(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setLightboxImage(null)
            }
          }}
          aria-label="Close image viewer"
        >
          <FontAwesomeIcon icon={faTimes} className="w-6 h-6 text-white" aria-hidden="true" />
        </button>
        <div className="max-w-7xl max-h-full" onClick={(e) => e.stopPropagation()}>
          <img
            src={imageUrl}
            alt={`Full size view of ${lightboxImage.fileName}${lightboxImage.width && lightboxImage.height ? `, ${lightboxImage.width} by ${lightboxImage.height} pixels` : ''}`}
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
          <div className="mt-4 text-center text-gray-300 text-sm" role="status">
            {lightboxImage.fileName} ({(lightboxImage.size / 1024).toFixed(1)} KB)
            {lightboxImage.width && lightboxImage.height && (
              <span> • {lightboxImage.width} × {lightboxImage.height}</span>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (isUser) {
    // User message - right aligned with gray bubble
    return (
      <>
        <div className="px-4 py-3">
          <div className="max-w-3xl mx-auto flex flex-col items-end">
            <div 
              className="max-w-[70%] rounded-3xl px-5 py-3"
              style={{ backgroundColor: '#2F2F2F' }}
            >
              {message.images && message.images.length > 0 && renderImages(message.images)}
              <div className="text-sm whitespace-pre-wrap break-words" style={{ color: 'var(--color-foreground)' }}>
                {message.content}
              </div>
            </div>
            {/* Plugin hooks: Render UI under user messages */}
            <PluginHookRenderer hookType="message.render.user" message={message} />
          </div>
        </div>
        {renderLightbox()}
      </>
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
    <>
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
              {searchSources.slice(0, 5).map((source: any, idx: number) => {
                const sourceId = sourceRegistry?.getSourceIdByUrl(source.url)
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      if (sourceId !== undefined) {
                        // Dispatch event to highlight citations for this source
                        window.dispatchEvent(new CustomEvent('highlightCitation', {
                          detail: { sourceId }
                        }))
                        // Clear highlight after 3 seconds
                        setTimeout(() => {
                          window.dispatchEvent(new CustomEvent('highlightCitation', {
                            detail: { sourceId: null }
                          }))
                        }, 3000)
                      }
                    }}
                    className="hover:opacity-100 transition-opacity cursor-pointer"
                    title={`${source.title} - Click to highlight citations`}
                  >
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${source.url}&sz=16`}
                      alt={source.title}
                      className="w-4 h-4 rounded-sm opacity-70"
                    />
                  </button>
                )
              })}
            </div>
          </div>
        )}
        
        {/* Render images if present */}
        {message.images && message.images.length > 0 && (
          <div className="mb-3">
            {renderImages(message.images)}
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
                    <div key={index} className="markdown-content">
                      {renderContentWithCitations(textContent, renderer)}
                    </div>
                  ) : (
                    <div 
                      key={index} 
                      className="text-base leading-relaxed"
                      style={{ 
                        color: 'var(--color-foreground)',
                        lineHeight: '1.75'
                      }}
                    >
                      {renderContentWithCitations(textContent)}
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
                <img src={contentCopyIcon} alt="Copy" className="w-4 h-4" />
              )}
            </button>
            
            {/* Info Button */}
            <button
              onClick={() => setIsTokenDropdownOpen(!isTokenDropdownOpen)}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              title="Info"
            >
              <img src={infoIcon} alt="Info" className="w-4 h-4" />
            </button>
            
            {/* Refresh Button */}
            <button
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              title="Regenerate"
            >
              <img src={refreshIcon} alt="Refresh" className="w-4 h-4" />
            </button>
          </div>
        )}
        
        {/* Token Usage Dropdown */}
        {message.metadata?.tokenUsage && (
          <TokenUsageDropdown
            tokenUsage={message.metadata.tokenUsage}
            isOpen={isTokenDropdownOpen}
            onToggle={() => setIsTokenDropdownOpen(!isTokenDropdownOpen)}
          />
        )}
        
        {/* Plugin hooks: Render UI under assistant messages */}
        <PluginHookRenderer hookType="message.render.assistant" message={message} />
      </div>
    </div>
    {renderLightbox()}
  </>
  )
}
