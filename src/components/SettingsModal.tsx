import { useState, useEffect } from 'react'
import { X, Settings as SettingsIcon, Plug, ChevronDown, ChevronRight, Search, FolderOpen, Book } from 'lucide-react'
import { Button } from './ui/Button'
import { PluginCard } from './PluginCard'
import { PluginConfigPanel } from './PluginConfigPanel'
import type { ProviderConfig, ModelInfo } from '../types'
import type { BasePlugin } from '../plugins/core'
import { openPluginsDirectory } from '../services/externalPluginLoader'
import { cn } from '../lib/utils'

// Import the Settings components
import { Settings as SettingsContent } from './Settings'
import { WebSearchSettings, type WebSearchSettings as WebSearchSettingsType } from './WebSearchSettings'
import { PluginDocumentation } from './PluginDocumentation'
import { ProviderSettings } from './ProviderSettings'

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
  onReloadPlugin: (pluginId: string) => Promise<void>
  onCreateTemplatePlugin?: (pluginName: string) => Promise<void>

  // Modal props
  onClose: () => void
}

type Tab = 'settings' | 'websearch' | 'plugins' | 'plugin-docs-getting-started' | 'plugin-docs-api' | 'plugin-docs-examples' | 'plugin-docs-hooks' | 'provider-ollama' | 'provider-openai' | 'provider-anthropic' | 'provider-lmstudio' | 'provider-openrouter'
type DocPage = 'getting-started' | 'api' | 'examples' | 'hooks'
type ProviderType = 'ollama' | 'openai' | 'anthropic' | 'lmstudio' | 'openrouter'

export function SettingsModal({
  providers,
  selectedProvider: _selectedProvider,
  models: _models,
  selectedModel,
  isLoadingModels: _isLoadingModels,
  webSearchSettings,
  onSelectProvider: _onSelectProvider,
  onSelectModel,
  onUpdateProvider,
  onTestProvider,
  onLoadModels: _onLoadModels,
  onUpdateWebSearchSettings,
  plugins,
  onEnablePlugin,
  onDisablePlugin,
  onReloadPlugin,
  onCreateTemplatePlugin,
  onClose
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('settings')
  const [builtinExpanded, setBuiltinExpanded] = useState(true)
  const [externalExpanded, setExternalExpanded] = useState(true)
  const [pluginDocsExpanded, setPluginDocsExpanded] = useState(false)
  const [providersExpanded, setProvidersExpanded] = useState(false)
  const [reloadingPlugins, setReloadingPlugins] = useState<Set<string>>(new Set())
  const [reloadErrors, setReloadErrors] = useState<Record<string, string>>({})
  const [configuringPlugin, setConfiguringPlugin] = useState<BasePlugin | null>(null)



  // Auto-expand plugin docs when a plugin docs tab is active
  useEffect(() => {
    if (pluginDocsTabs.some(t => t.id === activeTab)) {
      setPluginDocsExpanded(true)
    }
  }, [activeTab])

  // Auto-expand providers when a provider tab is active
  useEffect(() => {
    if (providerTabs.some(t => t.id === activeTab)) {
      setProvidersExpanded(true)
    }
  }, [activeTab])

  const tabs = [
    { id: 'settings' as Tab, label: 'Settings', icon: SettingsIcon },
    { id: 'websearch' as Tab, label: 'Web Search', icon: Search },
    { id: 'plugins' as Tab, label: 'Plugins', icon: Plug }
  ]

  const pluginDocsTabs = [
    { id: 'plugin-docs-getting-started' as Tab, label: 'Getting Started', docPage: 'getting-started' as DocPage },
    { id: 'plugin-docs-api' as Tab, label: 'API Reference', docPage: 'api' as DocPage },
    { id: 'plugin-docs-examples' as Tab, label: 'Examples', docPage: 'examples' as DocPage },
    { id: 'plugin-docs-hooks' as Tab, label: 'Hooks Reference', docPage: 'hooks' as DocPage }
  ]

  const providerTabs = [
    { id: 'provider-ollama' as Tab, label: 'Ollama', providerType: 'ollama' as ProviderType },
    { id: 'provider-lmstudio' as Tab, label: 'LM Studio', providerType: 'lmstudio' as ProviderType },
    { id: 'provider-openai' as Tab, label: 'OpenAI', providerType: 'openai' as ProviderType },
    { id: 'provider-anthropic' as Tab, label: 'Anthropic', providerType: 'anthropic' as ProviderType },
    { id: 'provider-openrouter' as Tab, label: 'OpenRouter', providerType: 'openrouter' as ProviderType }
  ]

  // Separate plugins into builtin and external
  const builtinPlugins = plugins.filter(p => p.metadata.isBuiltin)
  const externalPlugins = plugins.filter(p => !p.metadata.isBuiltin)

  // Handle plugin reload with error handling
  const handleReloadPlugin = async (pluginId: string) => {
    // Clear any previous error for this plugin
    setReloadErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[pluginId]
      return newErrors
    })

    // Add to reloading set
    setReloadingPlugins(prev => new Set(prev).add(pluginId))

    try {
      await onReloadPlugin(pluginId)
      console.log(`[SettingsModal] Successfully reloaded plugin: ${pluginId}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error(`[SettingsModal] Failed to reload plugin ${pluginId}:`, error)

      // Store error for display
      setReloadErrors(prev => ({
        ...prev,
        [pluginId]: errorMessage
      }))
    } finally {
      // Remove from reloading set
      setReloadingPlugins(prev => {
        const newSet = new Set(prev)
        newSet.delete(pluginId)
        return newSet
      })
    }
  }

  // Handle plugin configuration
  const handleConfigurePlugin = (pluginId: string) => {
    const plugin = plugins.find(p => p.metadata.id === pluginId)
    if (plugin) {
      setConfiguringPlugin(plugin)
    }
  }

  // Handle config save
  const handleConfigSave = (pluginId: string, config: Record<string, any>) => {
    console.log(`[SettingsModal] Config saved for plugin ${pluginId}:`, config)

    // Trigger onConfigChange lifecycle hook if plugin has it
    const plugin = plugins.find(p => p.metadata.id === pluginId)
    if (plugin && typeof plugin.onConfigChange === 'function') {
      try {
        plugin.onConfigChange(config)
      } catch (error) {
        console.error(`[SettingsModal] Error calling onConfigChange for ${pluginId}:`, error)
      }
    }
  }

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

            {/* Providers Dropdown */}
            <div>
              <button
                onClick={() => setProvidersExpanded(!providersExpanded)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  providerTabs.some(t => t.id === activeTab)
                    ? 'bg-primary/20 text-foreground'
                    : 'text-muted-foreground hover:bg-white/10 hover:text-foreground'
                )}
              >
                <SettingsIcon className="w-4 h-4" />
                <span className="flex-1 text-left">Providers</span>
                {providersExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>

              {providersExpanded && (
                <div className="ml-4 mt-1 space-y-1">
                  {providerTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                        activeTab === tab.id
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-white/10 hover:text-foreground'
                      )}
                    >
                      <span className="flex-1 text-left">{tab.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Plugin Docs Dropdown */}
            <div>
              <button
                onClick={() => setPluginDocsExpanded(!pluginDocsExpanded)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  pluginDocsTabs.some(t => t.id === activeTab)
                    ? 'bg-primary/20 text-foreground'
                    : 'text-muted-foreground hover:bg-white/10 hover:text-foreground'
                )}
              >
                <Book className="w-4 h-4" />
                <span className="flex-1 text-left">Plugin Docs</span>
                {pluginDocsExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>

              {pluginDocsExpanded && (
                <div className="ml-4 mt-1 space-y-1">
                  {pluginDocsTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                        activeTab === tab.id
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-white/10 hover:text-foreground'
                      )}
                    >
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
            <h2 className="text-2xl font-semibold">
              {tabs.find(t => t.id === activeTab)?.label ||
                pluginDocsTabs.find(t => t.id === activeTab)?.label ||
                providerTabs.find(t => t.id === activeTab)?.label ||
                'Settings'}
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'settings' && (
              <div className="p-6">
                <SettingsContent />
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

            {pluginDocsTabs.some(t => t.id === activeTab) && (
              <div className="h-full">
                <PluginDocumentation
                  page={pluginDocsTabs.find(t => t.id === activeTab)?.docPage || 'getting-started'}
                  onCreateTemplate={async () => {
                    if (onCreateTemplatePlugin) {
                      const pluginName = prompt('Enter plugin name:')
                      if (pluginName) {
                        try {
                          await onCreateTemplatePlugin(pluginName)
                        } catch (error) {
                          console.error('Failed to create template:', error)
                        }
                      }
                    }
                  }}
                  onOpenPluginsFolder={openPluginsDirectory}
                />
              </div>
            )}

            {providerTabs.some(t => t.id === activeTab) && (
              <div className="p-6">
                {(() => {
                  const providerTab = providerTabs.find(t => t.id === activeTab)
                  const provider = providers.find(p => p.type === providerTab?.providerType)

                  if (!provider || !providerTab) {
                    return (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">Provider not found</p>
                      </div>
                    )
                  }

                  return (
                    <ProviderSettings
                      key={provider.type}
                      provider={provider}
                      selectedModel={selectedModel}
                      onUpdateProvider={onUpdateProvider}
                      onTestProvider={onTestProvider}
                      onSelectModel={onSelectModel}
                      onLoadModels={_onLoadModels}
                    />
                  )
                })()}
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
                          onConfigure={handleConfigurePlugin}
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
                      {/* Open Plugins Folder Button */}
                      <div className="flex justify-end mb-4">
                        <button
                          onClick={() => openPluginsDirectory()}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm"
                          style={{ color: 'var(--color-foreground)' }}
                        >
                          <FolderOpen className="w-4 h-4" />
                          Open Plugins Folder
                        </button>
                      </div>

                      {externalPlugins.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-border rounded-lg">
                          <Plug className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground mb-2">
                            No external plugins installed
                          </p>
                          <p className="text-xs text-muted-foreground mb-4">
                            Click "Open Plugins Folder" above to add custom plugins
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {externalPlugins.map((plugin) => (
                            <div key={plugin.metadata.id} className="space-y-2">
                              <PluginCard
                                plugin={plugin.metadata}
                                onEnable={onEnablePlugin}
                                onDisable={onDisablePlugin}
                                onConfigure={handleConfigurePlugin}
                                onReload={handleReloadPlugin}
                                onUninstall={(id) => console.log('Uninstall:', id)}
                                isReloading={reloadingPlugins.has(plugin.metadata.id)}
                              />
                              {reloadErrors[plugin.metadata.id] && (
                                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                                  <p className="text-xs text-destructive font-medium mb-1">
                                    Reload Failed
                                  </p>
                                  <p className="text-xs text-destructive/80">
                                    {reloadErrors[plugin.metadata.id]}
                                  </p>
                                </div>
                              )}
                            </div>
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

      {/* Plugin Configuration Panel */}
      {configuringPlugin && (
        <PluginConfigPanel
          plugin={configuringPlugin.metadata}
          onClose={() => setConfiguringPlugin(null)}
          onSave={handleConfigSave}
        />
      )}
    </div>
  )
}
