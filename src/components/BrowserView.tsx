import { useState, useEffect } from 'react'
import { ArrowLeft, ArrowRight, RotateCw, Home, X, MessageSquare, History, Plus, MoreVertical } from 'lucide-react'
import { ChatArea } from './ChatArea'
import { formatTimestamp, cn } from '../lib/utils'
import { getProxiedUrl, isTauriEnvironment } from '../services/browserProxy'
import type { ChatSession, ProviderConfig, ModelInfo, ImageAttachment } from '../types'
import type { RendererPlugin } from '../plugins/core'
import type { SourceRegistry } from '../lib/web-search/sourceRegistry'

interface BrowserViewProps {
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

export function BrowserView({
  session,
  sessions,
  isGenerating,
  onSendMessage,
  onSendMessageWithNewChat,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  rendererPlugins,
  providers,
  selectedProvider,
  selectedModel,
  models,
  onSelectProvider,
  onSelectModel,
  onLoadModels,
  isLoadingModels,
  autoSearchEnabled,
  onToggleAutoSearch,
  personaEnabled,
  getSourceRegistry,
  onCloseBrowser
}: BrowserViewProps) {
  const [url, setUrl] = useState('')
  const [proxiedUrl, setProxiedUrl] = useState<string>('')
  const [inputUrl, setInputUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const [useProxy, setUseProxy] = useState(false) // Proxy disabled by default due to Tauri scope issues
  const [searchEngine, setSearchEngine] = useState<'google' | 'bing' | 'yahoo'>('google')

  // Search engine configurations (like custom browsers)
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

  const handleNavigate = async () => {
    let finalUrl = inputUrl.trim()
    
    console.log('[BrowserView] Navigate - Input:', finalUrl)
    console.log('[BrowserView] Navigate - Search Engine:', searchEngine)
    
    // Check if it's already a full URL with protocol
    const isFullUrl = finalUrl.startsWith('http://') || finalUrl.startsWith('https://')
    
    if (!isFullUrl) {
      // Everything goes through search engine - even domain names
      // This is better for custom browsers and avoids many issues
      finalUrl = searchEngines[searchEngine].search(finalUrl)
      console.log('[BrowserView] Navigate - Generated Search URL:', finalUrl)
    } else {
      console.log('[BrowserView] Navigate - Direct URL:', finalUrl)
    }
    
    setUrl(finalUrl)
    setIsLoading(true)
    
    // Don't use proxy for search engines (they block iframes anyway)
    const isSearchEngineUrl = finalUrl.includes('google.com/search') || 
                              finalUrl.includes('bing.com/search') ||
                              finalUrl.includes('yahoo.com/search')
    
    console.log('[BrowserView] Navigate - Is Search Engine URL:', isSearchEngineUrl)
    console.log('[BrowserView] Navigate - Final URL:', finalUrl)
    
    // Fetch through proxy if in Tauri, proxy is enabled, and not a search engine
    if (useProxy && isTauriEnvironment() && !isSearchEngineUrl) {
      try {
        const proxied = await getProxiedUrl(finalUrl)
        setProxiedUrl(proxied)
      } catch (error) {
        console.error('[BrowserView] Proxy failed, using direct URL:', error)
        setProxiedUrl(finalUrl)
      }
    } else {
      // Use direct URL for search engines and when proxy is disabled
      setProxiedUrl(finalUrl)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNavigate()
    }
  }

  const handleRefresh = async () => {
    setIsLoading(true)
    
    // Check if it's a search engine URL
    const isSearchEngineUrl = url.includes('google.com/search') || 
                              url.includes('bing.com/search') ||
                              url.includes('yahoo.com/search')
    
    // Re-fetch through proxy only if not a search engine
    if (useProxy && isTauriEnvironment() && !isSearchEngineUrl) {
      try {
        const proxied = await getProxiedUrl(url)
        setProxiedUrl(proxied)
      } catch (error) {
        console.error('[BrowserView] Proxy failed, using direct URL:', error)
        setProxiedUrl(url)
      }
    } else {
      // Force iframe reload
      const currentUrl = proxiedUrl
      setProxiedUrl('')
      setTimeout(() => setProxiedUrl(currentUrl), 10)
    }
  }

  const handleHome = async () => {
    const homeUrl = searchEngines[searchEngine].home
    setUrl(homeUrl)
    setInputUrl(homeUrl)
    setIsLoading(true)
    
    // Always use direct URL for search engine home pages
    setProxiedUrl(homeUrl)
  }

  const handleLoadEnd = () => {
    setIsLoading(false)
  }

  // Load initial URL (home page of selected search engine)
  useEffect(() => {
    const homeUrl = searchEngines[searchEngine].home
    setUrl(homeUrl)
    setInputUrl(homeUrl)
    
    const loadHome = async () => {
      setIsLoading(true)
      // Always use direct URL for search engine home pages (they don't work with proxy)
      setProxiedUrl(homeUrl)
    }
    
    loadHome()
  }, [])

  // Listen for navigation messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'navigate' && event.data?.url) {
        setInputUrl(event.data.url)
        setUrl(event.data.url)
        handleNavigate()
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

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
              onClick={() => window.history.back()}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              title="Back"
              aria-label="Go back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => window.history.forward()}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              title="Forward"
              aria-label="Go forward"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleRefresh}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              title="Refresh"
              aria-label="Refresh page"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
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
              placeholder="Enter URL..."
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
            {/* Toggle Chat Button */}
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={cn(
                "p-1.5 rounded transition-colors",
                isChatOpen ? "bg-white/15 hover:bg-white/20" : "hover:bg-white/10"
              )}
              title={isChatOpen ? 'Hide Chat' : 'Show Chat'}
              aria-label={isChatOpen ? 'Hide chat' : 'Show chat'}
            >
              <MessageSquare className="w-4 h-4" />
            </button>

            {/* Close Browser Button */}
            <button
              onClick={onCloseBrowser}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              title="Close Browser"
              aria-label="Close browser"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Browser Content */}
        <div className="flex-1 relative overflow-hidden" style={{ backgroundColor: '#1a1a1a' }}>
          {isLoading && (
            <div 
              className="absolute inset-0 flex items-center justify-center z-10"
              style={{ backgroundColor: 'var(--color-main)' }}
            >
              <div className="flex flex-col items-center gap-3">
                <RotateCw className="w-8 h-8 animate-spin" style={{ color: 'var(--color-accent)' }} />
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            </div>
          )}
          
          {proxiedUrl && (
            <iframe
              key={proxiedUrl}
              src={proxiedUrl}
              className="w-full h-full border-0"
              title="Browser"
              onLoad={handleLoadEnd}
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads allow-modals allow-popups-to-escape-sandbox allow-top-navigation"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            />
          )}
        </div>

        {/* Footer Info */}
        <div 
          className="px-3 py-1.5 text-xs flex items-center justify-between border-t"
          style={{ 
            borderColor: 'rgba(255, 255, 255, 0.1)',
            backgroundColor: 'var(--color-sidebar)',
            color: 'rgba(255, 255, 255, 0.4)'
          }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="opacity-75 flex-shrink-0">
              {isTauriEnvironment() && useProxy ? '🔒 Proxy' : '⚠️ Direct'}
            </span>
            <span className="opacity-50 flex-shrink-0">•</span>
            <select
              value={searchEngine}
              onChange={(e) => setSearchEngine(e.target.value as any)}
              className="px-2 py-0.5 rounded text-xs bg-white/5 border border-white/10 outline-none hover:bg-white/10 transition-colors flex-shrink-0"
              style={{ color: 'var(--color-foreground)' }}
            >
              <option value="google">Google</option>
              <option value="bing">Bing</option>
              <option value="yahoo">Yahoo</option>
            </select>
            <span className="opacity-50 flex-shrink-0">•</span>
            <span className="opacity-50 truncate text-xs" title={url}>
              {url || 'No URL'}
            </span>
          </div>
          {isTauriEnvironment() && (
            <button
              onClick={() => setUseProxy(!useProxy)}
              className="px-2 py-0.5 rounded text-xs hover:bg-white/10 transition-colors"
              style={{ color: 'var(--color-accent)' }}
            >
              {useProxy ? 'Disable Proxy' : 'Enable Proxy'}
            </button>
          )}
        </div>
      </div>

      {/* Chat Sidebar */}
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
              {/* New Chat Button */}
              <button
                onClick={onNewChat}
                className="p-1.5 rounded hover:bg-white/10 transition-colors"
                title="New Chat"
                aria-label="New Chat"
              >
                <Plus className="w-4 h-4" />
              </button>
              
              {/* History Toggle Button */}
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  showHistory ? "bg-white/15 hover:bg-white/20" : "hover:bg-white/10"
                )}
                title={showHistory ? "Hide History" : "Show History"}
                aria-label={showHistory ? "Hide history" : "Show history"}
              >
                <History className="w-4 h-4" />
              </button>
              
              {/* Close Chat Button */}
              <button
                onClick={() => setIsChatOpen(false)}
                className="p-1.5 rounded hover:bg-white/10 transition-colors"
                title="Hide Chat"
                aria-label="Hide chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content Area - History or Chat */}
          <div className="flex-1 overflow-hidden flex">
            {/* History Panel */}
            {showHistory && (
              <div 
                className="w-full overflow-y-auto"
                style={{ backgroundColor: 'var(--color-sidebar)' }}
              >
                <div className="p-3">
                  <h4 className="text-xs font-semibold text-muted-foreground mb-3">Chat History</h4>
                  <div className="space-y-1">
                    {sessions.map((sess) => (
                      <div
                        key={sess.id}
                        className={cn(
                          "group relative rounded-lg transition-colors cursor-pointer",
                          session?.id === sess.id
                            ? "bg-white/10"
                            : "hover:bg-white/5"
                        )}
                      >
                        <div
                          className="flex items-center justify-between p-3"
                          onClick={() => {
                            onSelectSession(sess)
                            setShowHistory(false)
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            {editingSessionId === sess.id ? (
                              <input
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onBlur={() => {
                                  if (editingTitle.trim()) {
                                    onRenameSession(sess.id, editingTitle.trim())
                                  }
                                  setEditingSessionId(null)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    if (editingTitle.trim()) {
                                      onRenameSession(sess.id, editingTitle.trim())
                                    }
                                    setEditingSessionId(null)
                                  } else if (e.key === 'Escape') {
                                    setEditingSessionId(null)
                                  }
                                }}
                                className="w-full bg-transparent border-none outline-none text-sm"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <>
                                <p className="text-sm font-medium truncate">{sess.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatTimestamp(sess.updatedAt)}
                                </p>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <button
                              className="p-2 rounded-md hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenMenuId(openMenuId === sess.id ? null : sess.id)
                              }}
                            >
                              <MoreVertical className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </div>
                        </div>

                        {/* Context Menu */}
                        {openMenuId === sess.id && (
                          <div
                            className="absolute right-2 top-12 z-10 rounded-lg shadow-lg border min-w-[120px]"
                            style={{ backgroundColor: 'var(--color-sidebar)' }}
                          >
                            <button
                              className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingSessionId(sess.id)
                                setEditingTitle(sess.title)
                                setOpenMenuId(null)
                              }}
                            >
                              Rename
                            </button>
                            <button
                              className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-white/10 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (deletingSessionId === sess.id) {
                                  onDeleteSession(sess.id)
                                  setDeletingSessionId(null)
                                } else {
                                  setDeletingSessionId(sess.id)
                                  setTimeout(() => setDeletingSessionId(null), 3000)
                                }
                                setOpenMenuId(null)
                              }}
                            >
                              {deletingSessionId === sess.id ? 'Sure?' : 'Delete'}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Chat Area */}
            {!showHistory && (
              <div className="flex-1 overflow-hidden">
                <ChatArea
                  session={session}
                  isGenerating={isGenerating}
                  onSendMessage={onSendMessage}
                  onSendMessageWithNewChat={onSendMessageWithNewChat}
                  rendererPlugins={rendererPlugins}
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
                  // Don't pass onTogglePersonaSidebar in browser mode - hides the persona button
                  personaEnabled={personaEnabled}
                  getSourceRegistry={getSourceRegistry}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
