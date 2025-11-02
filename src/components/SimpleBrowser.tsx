import { useState } from 'react'
import { Home, X, MessageSquare, History, Plus } from 'lucide-react'
import { ChatArea } from './ChatArea'
import { cn } from '../lib/utils'
import type { ChatSession, ProviderConfig, ModelInfo, ImageAttachment } from '../types'
import type { RendererPlugin } from '../plugins/core'
import type { SourceRegistry } from '../lib/web-search/sourceRegistry'

interface SimpleBrowserProps {
  // Chat props
  session: ChatSession | null
  sessions: ChatSession[]
  isGenerating: boolean
  onSendMessage: (content: string, images?: ImageAttachment[]) => void
  onSendMessageWithNewChat: (content: string, images?: ImageAttachment[]) => void
  onNewChat: () => void
  onSelectSession: (session: ChatSession) => void
  onDeleteSession: (sessionId: string) => void
  onRenameSession: (sessionId: string, newTitle: string) => void
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
  
  // Browser props
  onCloseBrowser: () => void
}

export function SimpleBrowser(props: SimpleBrowserProps) {
  const [inputUrl, setInputUrl] = useState('')
  const [displayUrl, setDisplayUrl] = useState('Search or enter URL...')
  const [isChatOpen, setIsChatOpen] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [searchEngine] = useState<'google' | 'bing' | 'yahoo'>('google')

  const searchEngines = {
    google: {
      name: 'Google',
      home: 'https://www.google.com',
      search: (query: string) => `https://www.google.com/search?q=${encodeURIComponent(query)}`
    },
    bing: {
      name: 'Bing', 
      home: 'https://www.bing.com',
      search: (query: string) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`
    },
    yahoo: {
      name: 'Yahoo',
      home: 'https://www.yahoo.com',
      search: (query: string) => `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`
    }
  }

  const handleNavigate = () => {
    let finalUrl = inputUrl.trim()
    
    if (!finalUrl) return
    
    // Check if it's already a full URL with protocol
    const isFullUrl = finalUrl.startsWith('http://') || finalUrl.startsWith('https://')
    
    if (!isFullUrl) {
      // Everything goes through search engine
      finalUrl = searchEngines[searchEngine].search(finalUrl)
    }
    
    setDisplayUrl(finalUrl)
    
    // Open in system browser
    window.open(finalUrl, '_blank')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNavigate()
    }
  }

  const handleHome = () => {
    const homeUrl = searchEngines[searchEngine].home
    setInputUrl(homeUrl)
    setDisplayUrl(homeUrl)
    
    window.open(homeUrl, '_blank')
  }

  return (
    <div className="flex h-full">
      {/* Browser Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Browser Header */}
        <div 
          className="flex items-center gap-2 px-3 py-2 border-b"
          style={{ 
            borderColor: 'rgba(255, 255, 255, 0.1)',
            backgroundColor: 'var(--color-sidebar)'
          }}
        >
          {/* Navigation Buttons */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleHome}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              title="Home"
              aria-label="Go to home"
            >
              <Home className="w-4 h-4" />
            </button>
          </div>

          {/* URL Bar */}
          <div className="flex-1 flex items-center gap-2">
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Search or enter URL..."
              className="flex-1 px-3 py-1.5 rounded text-sm outline-none transition-colors"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--color-foreground)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            />
            <button
              onClick={handleNavigate}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors hover:opacity-90"
              style={{
                backgroundColor: 'var(--color-accent)',
                color: 'white'
              }}
            >
              Go
            </button>
          </div>

          {/* Right Buttons */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={cn(
                "p-1.5 rounded transition-colors",
                isChatOpen ? "bg-white/15 hover:bg-white/20" : "hover:bg-white/10"
              )}
              title={isChatOpen ? 'Hide Chat' : 'Show Chat'}
            >
              <MessageSquare className="w-4 h-4" />
            </button>

            <button
              onClick={props.onCloseBrowser}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              title="Close Browser"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Browser Content - Info Message */}
        <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#1a1a1a' }}>
          <div className="text-center max-w-md px-6">
            <div className="mb-4">
              <svg className="w-16 h-16 mx-auto opacity-50" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 9a1 1 0 012 0v4a1 1 0 11-2 0V9zm1-5a1 1 0 100 2 1 1 0 000-2z"/>
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Browser Opens Externally</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Due to security restrictions (CORS, X-Frame-Options), websites cannot be displayed in an embedded browser.
            </p>
            <p className="text-sm text-muted-foreground">
              When you search or enter a URL, it will open in your system's default browser.
            </p>
            <div className="mt-6 p-3 rounded" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
              <p className="text-xs opacity-75">
                Current: {displayUrl}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div 
          className="px-3 py-1.5 text-xs flex items-center justify-center border-t"
          style={{ 
            borderColor: 'rgba(255, 255, 255, 0.1)',
            backgroundColor: 'var(--color-sidebar)',
            color: 'rgba(255, 255, 255, 0.4)'
          }}
        >
          <span className="opacity-75">
            🌐 Links open in system browser • Use Chat Assistant for web research
          </span>
        </div>
      </div>

      {/* Chat Sidebar - Same as before */}
      <div 
        className="flex-shrink-0 transition-all duration-300 ease-in-out border-l"
        style={{ 
          width: isChatOpen ? '400px' : '0px',
          overflow: 'hidden',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          backgroundColor: 'var(--color-main)'
        }}
      >
        <div className="h-full flex flex-col">
          {/* Chat Header */}
          <div 
            className="px-3 py-2.5 border-b flex items-center justify-between"
            style={{ 
              borderColor: 'rgba(255, 255, 255, 0.1)',
              backgroundColor: 'var(--color-sidebar)'
            }}
          >
            <h3 className="text-sm font-medium">Chat Assistant</h3>
            <div className="flex items-center gap-0.5">
              <button
                onClick={props.onNewChat}
                className="p-1.5 rounded hover:bg-white/10 transition-colors"
                title="New Chat"
              >
                <Plus className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  showHistory ? "bg-white/15 hover:bg-white/20" : "hover:bg-white/10"
                )}
                title={showHistory ? "Hide History" : "Show History"}
              >
                <History className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => setIsChatOpen(false)}
                className="p-1.5 rounded hover:bg-white/10 transition-colors"
                title="Hide Chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content - Chat or History */}
          <div className="flex-1 overflow-hidden flex">
            {!showHistory && (
              <div className="flex-1 overflow-hidden">
                <ChatArea
                  session={props.session}
                  isGenerating={props.isGenerating}
                  onSendMessage={props.onSendMessage}
                  onSendMessageWithNewChat={props.onSendMessageWithNewChat}
                  rendererPlugins={props.rendererPlugins}
                  providers={props.providers}
                  selectedProvider={props.selectedProvider}
                  selectedModel={props.selectedModel}
                  models={props.models}
                  onSelectProvider={props.onSelectProvider}
                  onSelectModel={props.onSelectModel}
                  onLoadModels={props.onLoadModels}
                  isLoadingModels={props.isLoadingModels}
                  autoSearchEnabled={props.autoSearchEnabled}
                  onToggleAutoSearch={props.onToggleAutoSearch}
                  personaEnabled={props.personaEnabled}
                  getSourceRegistry={props.getSourceRegistry}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
