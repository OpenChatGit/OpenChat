import { useEffect, useRef } from 'react'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import type { ChatSession, ProviderConfig, ModelInfo } from '../types'
import type { RendererPlugin, ReasoningDetectorPlugin, UIExtensionPlugin } from '../plugins/types'

interface ChatAreaProps {
  session: ChatSession | null
  isGenerating: boolean
  onSendMessage: (content: string) => void
  onSendMessageWithNewChat: (content: string) => void
  rendererPlugins?: RendererPlugin[]
  reasoningDetector?: ReasoningDetectorPlugin
  uiExtensions?: UIExtensionPlugin[]
  providers: ProviderConfig[]
  selectedProvider: ProviderConfig | null
  selectedModel: string
  models: ModelInfo[]
  onSelectProvider: (provider: ProviderConfig) => void
  onSelectModel: (model: string) => void
  onLoadModels: (provider: ProviderConfig) => void
  webSearchEnabled?: boolean
  onToggleWebSearch?: () => void
}

export function ChatArea({ 
  session, 
  isGenerating, 
  onSendMessage, 
  onSendMessageWithNewChat,
  rendererPlugins = [],
  reasoningDetector,
  uiExtensions = [],
  providers,
  selectedProvider,
  selectedModel,
  models,
  onSelectProvider,
  onSelectModel,
  onLoadModels,
  webSearchEnabled = false,
  onToggleWebSearch = () => {}
}: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session?.messages])

  // Show centered input only when no session exists
  const showCenteredInput = !session

  if (showCenteredInput) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-semibold mb-2" style={{ color: 'var(--color-foreground)' }}>
            How can I help you today?
          </h2>
        </div>
        <div className="w-full max-w-3xl px-4">
          <ChatInput
            onSend={onSendMessageWithNewChat}
            disabled={false}
            isGenerating={false}
            centered={true}
            providers={providers}
            selectedProvider={selectedProvider}
            selectedModel={selectedModel}
            models={models}
            onSelectProvider={onSelectProvider}
            onSelectModel={onSelectModel}
            onLoadModels={onLoadModels}
            webSearchEnabled={webSearchEnabled}
            onToggleWebSearch={onToggleWebSearch}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {session.messages.length === 0 ? (
          <div className="flex-1"></div>
        ) : (
          <div>
            {session.messages.map((message) => (
              <ChatMessage 
                key={message.id} 
                message={message} 
                rendererPlugins={rendererPlugins}
                reasoningDetector={reasoningDetector}
                uiExtensions={uiExtensions}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={onSendMessage}
        disabled={isGenerating}
        isGenerating={isGenerating}
        providers={providers}
        selectedProvider={selectedProvider}
        selectedModel={selectedModel}
        models={models}
        onSelectProvider={onSelectProvider}
        onSelectModel={onSelectModel}
        onLoadModels={onLoadModels}
        webSearchEnabled={webSearchEnabled}
        onToggleWebSearch={onToggleWebSearch}
      />
    </div>
  )
}
