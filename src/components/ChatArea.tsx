import { useEffect, useRef, useState } from 'react'
import { User } from 'lucide-react'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import type { ChatSession, ProviderConfig, ModelInfo, ImageAttachment } from '../types'
import type { RendererPlugin } from '../plugins/core'
import type { SourceRegistry } from '../lib/web-search/sourceRegistry'
import { PluginHookRenderer } from './PluginHookRenderer'

interface ChatAreaProps {
  session: ChatSession | null
  isGenerating: boolean
  onSendMessage: (content: string, images?: ImageAttachment[]) => void
  onSendMessageWithNewChat: (content: string, images?: ImageAttachment[]) => void
  onRegenerateMessage?: (messageId: string) => void
  rendererPlugins?: RendererPlugin[]
  providers: ProviderConfig[]
  selectedProvider: ProviderConfig | null
  selectedModel: string
  models: ModelInfo[]
  onSelectProvider: (provider: ProviderConfig) => void
  onSelectModel: (model: string) => void
  onLoadModels: (provider: ProviderConfig) => void
  isLoadingModels?: boolean
  autoSearchEnabled?: boolean
  onToggleAutoSearch?: () => void
  personaEnabled?: boolean
  getSourceRegistry: () => SourceRegistry
  onTogglePromptSettings?: () => void
}

export function ChatArea({ 
  session, 
  isGenerating, 
  onSendMessage, 
  onSendMessageWithNewChat,
  onRegenerateMessage,
  rendererPlugins = [],
  providers,
  selectedProvider,
  selectedModel,
  models,
  onSelectProvider,
  onSelectModel,
  onLoadModels,
  isLoadingModels = false,
  autoSearchEnabled = false,
  onToggleAutoSearch = () => {},
  personaEnabled = false,
  getSourceRegistry,
  onTogglePromptSettings
}: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [modelCapabilities, setModelCapabilities] = useState<ModelInfo['capabilities']>()

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
            autoSearchEnabled={autoSearchEnabled}
            onToggleAutoSearch={onToggleAutoSearch}
            modelCapabilities={modelCapabilities}
            onCapabilitiesChange={setModelCapabilities}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto relative">
        {/* Floating Toolbar Area */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          {/* Plugin hooks: Add toolbar buttons */}
          {session && <PluginHookRenderer hookType="ui.toolbar" />}
          
          {/* Unified Prompt Settings Button - Always visible */}
          {onTogglePromptSettings && (
            <button
              onClick={onTogglePromptSettings}
              className={`relative p-2 rounded-lg transition-all duration-200 hover:scale-105 shadow-lg ${
                personaEnabled ? 'ring-2 ring-green-400/30' : ''
              }`}
              style={{
                backgroundColor: personaEnabled ? 'var(--color-accent)' : 'var(--color-sidebar)',
                color: personaEnabled ? 'white' : 'var(--color-foreground)',
                opacity: personaEnabled ? 1 : 0.8
              }}
              title={personaEnabled ? "Persona Active - Click to configure prompts" : "Prompt Settings (Persona & System)"}
              aria-label="Prompt Settings"
            >
              <User size={20} />
              {personaEnabled && (
                <>
                  <span 
                    className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-white shadow-sm animate-pulse"
                  />
                  {/* Subtle glow effect */}
                  <span 
                    className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 blur-sm opacity-50"
                  />
                </>
              )}
            </button>
          )}
        </div>
        {session.messages.length === 0 ? (
          <div className="flex-1"></div>
        ) : (
          <div>
            {session.messages.map((message, index) => {
              // Get previous message for autoSearch metadata
              const previousMessage = index > 0 ? session.messages[index - 1] : undefined
              
              // Show system messages only if they have a status (like 'searching')
              const shouldShowMessage = message.role !== 'system' || message.status === 'searching'
              
              return (
                <div key={message.id}>
                  {shouldShowMessage && (
                    <ChatMessage 
                      message={message} 
                      rendererPlugins={rendererPlugins}
                      previousMessage={previousMessage}
                      sourceRegistry={getSourceRegistry()}
                      onRegenerateMessage={onRegenerateMessage}
                      isGenerating={isGenerating}
                    />
                  )}
                </div>
              )
            })}
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
        isLoadingModels={isLoadingModels}
        autoSearchEnabled={autoSearchEnabled}
        onToggleAutoSearch={onToggleAutoSearch}
        modelCapabilities={modelCapabilities}
        onCapabilitiesChange={setModelCapabilities}
      />
    </div>
  )
}
