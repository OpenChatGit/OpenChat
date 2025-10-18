import { useState } from 'react'
import { X, Settings as SettingsIcon, Plug, ChevronDown, ChevronRight, Search } from 'lucide-react'
import { Button } from './ui/Button'
import { PluginCard } from './PluginCard'
import type { ProviderConfig, ModelInfo } from '../types'
import type { BasePlugin } from '../plugins/core'
import { cn } from '../lib/utils'

// Import the Settings components
import { Settings as SettingsContent } from './Settings'
import { WebSearchSettings, type WebSearchSettings as WebSearchSettingsType } from './WebSearchSettings'

interface SettingsModalProps {
  // Settings props
  providers: ProviderConfig[]
  selectedProvider: ProviderConfig | null
  models: ModelInfo[]
  selectedModel: string
  isLoadingModels: boolean
  webSearchSettings?: WebSearchSettingsType
  onSelectProvider: (provider: ProviderConfig) => void
  onSelectModel: (model: string) => void
  onUpdateProvider: (provider: ProviderConfig) => void
  onTestProvider: (provider: ProviderConfig) => Promise<boolean>
  onLoadModels: (provider: ProviderConfig) => void
  onUpdateWebSearchSettings?: (settings: WebSearchSettingsType) => void
  
  // Plugin props
  plugins: BasePlugin[]
  onEnablePlugin: (pluginId: string) => void
  onDisablePlugin: (pluginId: string) => void
  
  // Modal props
  onClose: () => void
}

type Tab = 'settings' | 'websearch' | 'plugins'

export function SettingsModal({
  providers,
  selectedProvider,
  models,
  selectedModel,
  isLoadingModels,
  webSearchSettings,
  onSelectProvider,
  onSelectModel,
  onUpdateProvider,
  onTestProvider,
  onLoadModels,
  onUpdateWebSearchSettings,
  plugins,
  onEnablePlugin,
  onDisablePlugin,
  onClose
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('settings')
  const [builtinExpanded, setBuiltinExpanded] = useState(true)
  const [externalExpanded, setExternalExpanded] = useState(true)

  const tabs = [
    { id: 'settings' as Tab, label: 'Settings', icon: SettingsIcon },
    { id: 'websearch' as Tab, label: 'Web Search', icon: Search },
    { id: 'plugins' as Tab, label: 'Plugins', icon: Plug }
  ]

  // Separate plugins into builtin and external
  const builtinPlugins = plugins.filter(p => p.metadata.isBuiltin)
  const externalPlugins = plugins.filter(p => !p.metadata.isBuiltin)

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-5xl h-[85vh] flex overflow-hidden">
        {/* Sidebar with Tabs */}
        <div
          className="w-48 flex-shrink-0 border-r border-border p-4"
          style={{ backgroundColor: 'var(--color-sidebar)' }}
        >
          <div className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-white/10 hover:text-foreground'
                )}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
            <h2 className="text-2xl font-semibold">
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'settings' && (
              <div className="p-6">
                <SettingsContent
                  providers={providers}
                  selectedProvider={selectedProvider}
                  models={models}
                  selectedModel={selectedModel}
                  isLoadingModels={isLoadingModels}
                  onClose={onClose}
                  onSelectProvider={onSelectProvider}
                  onSelectModel={onSelectModel}
                  onUpdateProvider={onUpdateProvider}
                  onTestProvider={onTestProvider}
                  onLoadModels={onLoadModels}
                />
              </div>
            )}

            {activeTab === 'websearch' && (
              <div className="p-6">
                <WebSearchSettings
                  settings={webSearchSettings}
                  onUpdateSettings={onUpdateWebSearchSettings}
                />
              </div>
            )}

            {activeTab === 'plugins' && (
              <div className="p-6 space-y-6">
                {/* Built-in Plugins */}
                <div>
                  <button
                    onClick={() => setBuiltinExpanded(!builtinExpanded)}
                    className="w-full flex items-center justify-between mb-4 hover:bg-white/5 p-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {builtinExpanded ? (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      )}
                      <div className="text-left">
                        <h3 className="text-lg font-semibold">Built-in Plugins</h3>
                        <p className="text-sm text-muted-foreground">
                          Core plugins that come with OpenChat
                        </p>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {builtinPlugins.length} plugin{builtinPlugins.length !== 1 ? 's' : ''}
                    </span>
                  </button>
                  {builtinExpanded && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {builtinPlugins.map((plugin) => (
                        <PluginCard
                          key={plugin.metadata.id}
                          plugin={plugin.metadata}
                          onEnable={onEnablePlugin}
                          onDisable={onDisablePlugin}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* External Plugins */}
                <div>
                  <button
                    onClick={() => setExternalExpanded(!externalExpanded)}
                    className="w-full flex items-center justify-between mb-4 hover:bg-white/5 p-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {externalExpanded ? (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      )}
                      <div className="text-left">
                        <h3 className="text-lg font-semibold">External Plugins</h3>
                        <p className="text-sm text-muted-foreground">
                          Community plugins you've installed
                        </p>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {externalPlugins.length} plugin{externalPlugins.length !== 1 ? 's' : ''}
                    </span>
                  </button>
                  {externalExpanded && (
                    <>
                      {externalPlugins.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-border rounded-lg">
                          <Plug className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground mb-2">
                            No external plugins installed
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Install plugins from the community to extend functionality
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {externalPlugins.map((plugin) => (
                            <PluginCard
                              key={plugin.metadata.id}
                              plugin={plugin.metadata}
                              onEnable={onEnablePlugin}
                              onDisable={onDisablePlugin}
                              onReload={(id) => console.log('Reload:', id)}
                              onUninstall={(id) => console.log('Uninstall:', id)}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
