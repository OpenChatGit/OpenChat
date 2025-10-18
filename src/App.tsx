import { useState, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { ChatArea } from './components/ChatArea'
import { SettingsModal } from './components/SettingsModal'
import { useChatWithTools } from './hooks/useChatWithTools'
import { useProviders } from './hooks/useProviders'
import { usePlugins } from './hooks/usePlugins'
import { ProviderHealthMonitor } from './services/ProviderHealthMonitor'
import type { RendererPlugin } from './plugins/core'

function App() {
  const [showSettings, setShowSettings] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  
  const { 
    pluginManager, 
    plugins, 
    enablePlugin, 
    disablePlugin 
  } = usePlugins()
  
  const {
    sessions,
    currentSession,
    setCurrentSession,
    isGenerating,
    autoSearchEnabled,
    setAutoSearchEnabled,
    webSearchSettings,
    updateWebSearchSettings,
    createSession,
    sendMessage,
    deleteSession,
    updateSessionTitle,
  } = useChatWithTools(pluginManager)

  const {
    providers,
    selectedProvider,
    setSelectedProvider,
    models,
    selectedModel,
    setSelectedModel,
    isLoadingModels,
    loadModels,
    testProvider,
    updateProvider,
  } = useProviders()

  // Load models when provider is selected
  useEffect(() => {
    if (selectedProvider) {
      loadModels(selectedProvider)
    }
  }, [selectedProvider, loadModels])

  // Initialize ProviderHealthMonitor on app mount
  useEffect(() => {
    const healthMonitor = ProviderHealthMonitor.getInstance()
    
    // Start monitoring with current providers
    healthMonitor.start(providers)
    
    // Cleanup: stop monitoring on unmount
    return () => {
      healthMonitor.stop()
    }
  }, [providers])

  const handleNewChat = () => {
    if (!selectedProvider || !selectedModel) {
      setShowSettings(true)
      return
    }
    const session = createSession(selectedProvider, selectedModel)
    setCurrentSession(session)
    return session
  }

  const handleSendMessage = async (content: string) => {
    if (!selectedProvider || !selectedModel || !currentSession) return
    await sendMessage(content, selectedProvider, selectedModel)
  }

  const handleSendMessageWithNewChat = async (content: string) => {
    if (!selectedProvider || !selectedModel) {
      setShowSettings(true)
      return
    }
    
    // Create user message first with stable, unique ID
    const userMessage = {
      id: `${Date.now()}-init`,
      role: 'user' as const,
      content,
      timestamp: Date.now(),
    }
    
    // Create session WITH the user message already in it
    const session = createSession(selectedProvider, selectedModel, userMessage)
    
    // Now send to AI (reuse existing user message to avoid duplicates)
    await sendMessage(content, selectedProvider, selectedModel, session)
  }

  return (
    <div className="flex h-screen overflow-hidden text-foreground relative" style={{ backgroundColor: 'var(--color-main)' }}>
      {/* Sidebar */}
      <div 
        className="flex-shrink-0 transition-all duration-300 ease-in-out"
        style={{ 
          width: isSidebarOpen ? '256px' : '0px',
          overflow: 'hidden'
        }}
      >
        <Sidebar
          sessions={sessions}
          currentSession={currentSession}
          onNewChat={handleNewChat}
          onSelectSession={setCurrentSession}
          onDeleteSession={deleteSession}
          onRenameSession={updateSessionTitle}
          onOpenSettings={() => setShowSettings(true)}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />
      </div>

      {/* Floating Toggle Button (when sidebar is closed) */}
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="absolute top-3 left-3 z-50 p-2 rounded-lg hover:bg-white/10 transition-colors"
          style={{ backgroundColor: 'var(--color-sidebar)' }}
          title="Open Sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor">
            <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm440-80h120v-560H640v560Zm-80 0v-560H200v560h360Zm80 0h120-120Z"/>
          </svg>
        </button>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0" style={{ backgroundColor: 'var(--color-main)' }}>
        {/* Chat */}
        <ChatArea
          session={currentSession}
          isGenerating={isGenerating}
          onSendMessage={handleSendMessage}
          onSendMessageWithNewChat={handleSendMessageWithNewChat}
          rendererPlugins={pluginManager.getByType<RendererPlugin>('renderer')}
          providers={providers}
          selectedProvider={selectedProvider}
          selectedModel={selectedModel}
          models={models}
          onSelectProvider={setSelectedProvider}
          onSelectModel={setSelectedModel}
          onLoadModels={loadModels}
          isLoadingModels={isLoadingModels}
          autoSearchEnabled={autoSearchEnabled}
          onToggleAutoSearch={() => setAutoSearchEnabled(!autoSearchEnabled)}
        />
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          providers={providers}
          selectedProvider={selectedProvider}
          models={models}
          selectedModel={selectedModel}
          isLoadingModels={isLoadingModels}
          webSearchSettings={webSearchSettings || undefined}
          onClose={() => setShowSettings(false)}
          onSelectProvider={setSelectedProvider}
          onSelectModel={setSelectedModel}
          onUpdateProvider={updateProvider}
          onTestProvider={testProvider}
          onLoadModels={loadModels}
          onUpdateWebSearchSettings={updateWebSearchSettings}
          plugins={plugins}
          onEnablePlugin={enablePlugin}
          onDisablePlugin={disablePlugin}
        />
      )}
    </div>
  )
}

export default App
