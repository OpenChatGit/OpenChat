import { useState, useRef, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowUp } from '@fortawesome/free-solid-svg-icons'
import { Globe } from 'lucide-react'
import { ModelSelector } from './ModelSelector'
import { cn } from '../lib/utils'
import type { ProviderConfig, ModelInfo } from '../types'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  isGenerating?: boolean
  centered?: boolean
  providers?: ProviderConfig[]
  selectedProvider?: ProviderConfig | null
  selectedModel?: string
  models?: ModelInfo[]
  onSelectProvider?: (provider: ProviderConfig) => void
  onSelectModel?: (model: string) => void
  onLoadModels?: (provider: ProviderConfig) => void
  isLoadingModels?: boolean
  autoSearchEnabled?: boolean
  onToggleAutoSearch?: () => void
}

export function ChatInput({ 
  onSend, 
  disabled, 
  isGenerating, 
  centered = false,
  providers = [],
  selectedProvider = null,
  selectedModel = '',
  models = [],
  onSelectProvider = () => {},
  onSelectModel = () => {},
  onLoadModels = () => {},
  isLoadingModels = false,
  autoSearchEnabled = false,
  onToggleAutoSearch = () => {}
}: ChatInputProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() && !disabled) {
      onSend(input.trim())
      setInput('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [input])

  return (
    <div className={centered ? '' : 'pb-6 px-4'}>
      <div className={centered ? 'w-full' : 'max-w-3xl mx-auto'}>
        {/* Modern Island Container */}
        <div 
          className="rounded-3xl shadow-lg"
          style={{ backgroundColor: '#2C2C2E', overflow: 'visible' }}
        >
          <form onSubmit={handleSubmit}>
            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={disabled}
              rows={1}
              className={cn(
                'w-full resize-none bg-transparent px-6 pt-4 pb-2 rounded-t-3xl',
                'text-sm placeholder:text-muted-foreground',
                'focus-visible:outline-none',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'max-h-[200px] overflow-y-auto'
              )}
              style={{ color: 'var(--color-foreground)' }}
            />
            
            {/* Bottom Section with Web Search Toggle, Model Selector and Send Button */}
            <div className="px-4 pb-3 flex items-center justify-between gap-2">
                {/* Left Side: Web Search Toggle */}
                <button
                  type="button"
                  onClick={onToggleAutoSearch}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0 hover:bg-white/10"
                  title={autoSearchEnabled ? 'Web search enabled' : 'Web search disabled'}
                  aria-label={autoSearchEnabled ? 'Disable web search' : 'Enable web search'}
                >
                  <Globe 
                    className="w-4 h-4 transition-colors"
                    style={{ 
                      color: autoSearchEnabled ? 'rgb(59, 130, 246)' : '#8E8E93',
                      strokeWidth: 2
                    }}
                  />
                </button>

                {/* Right Side: Model Selector and Send Button */}
                <div className="flex items-center gap-2">
                  {/* Model Selector */}
                  {providers.length > 0 && (
                  <ModelSelector
                    providers={providers}
                    selectedProvider={selectedProvider}
                    selectedModel={selectedModel}
                    models={models}
                    onSelectProvider={onSelectProvider}
                    onSelectModel={onSelectModel}
                    onLoadModels={onLoadModels}
                    isLoadingModels={isLoadingModels}
                    openUpwards={!centered}
                  />
                  )}
                  
                  {/* Send/Stop Button */}
                  <button
                    type="submit"
                    disabled={!input.trim() || disabled || isGenerating}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0"
                    style={{
                      backgroundColor: input.trim() && !disabled && !isGenerating ? '#FFFFFF' : '#1A1A1C',
                      cursor: input.trim() && !disabled && !isGenerating ? 'pointer' : 'not-allowed'
                    }}
                    title="Send message"
                    aria-label="Send message"
                  >
                    <FontAwesomeIcon 
                      icon={faArrowUp} 
                      className="w-4 h-4"
                      style={{ 
                        color: input.trim() && !disabled && !isGenerating ? '#000000' : '#565656'
                      }}
                    />
                  </button>
                </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
