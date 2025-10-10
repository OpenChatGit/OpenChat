import { useState } from 'react'
import { X, Check, AlertCircle, RefreshCw, Settings as SettingsIcon, Package } from 'lucide-react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { PluginManager } from './PluginManager'
import type { ProviderConfig, ModelInfo } from '../types'
import type { Plugin } from '../plugins/types'
import { cn } from '../lib/utils'

interface SettingsProps {
  providers: ProviderConfig[]
  selectedProvider: ProviderConfig | null
  models: ModelInfo[]
  selectedModel: string
  isLoadingModels: boolean
  plugins: Plugin[]
  onClose: () => void
  onSelectProvider: (provider: ProviderConfig) => void
  onSelectModel: (model: string) => void
  onUpdateProvider: (provider: ProviderConfig) => void
  onTestProvider: (provider: ProviderConfig) => Promise<boolean>
  onLoadModels: (provider: ProviderConfig) => void
  onEnablePlugin: (pluginId: string) => void
  onDisablePlugin: (pluginId: string) => void
}

export function Settings({
  providers,
  selectedProvider,
  models,
  selectedModel,
  isLoadingModels,
  plugins,
  onClose,
  onSelectProvider,
  onSelectModel,
  onUpdateProvider,
  onTestProvider,
  onLoadModels,
  onEnablePlugin,
  onDisablePlugin,
}: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'providers' | 'plugins'>('providers')
  const [editingProvider, setEditingProvider] = useState<ProviderConfig | null>(null)
  const [testResults, setTestResults] = useState<Record<string, boolean | null>>({})

  const handleTestConnection = async (provider: ProviderConfig) => {
    setTestResults((prev) => ({ ...prev, [provider.type]: null }))
    const result = await onTestProvider(provider)
    setTestResults((prev) => ({ ...prev, [provider.type]: result }))
  }

  const handleSaveProvider = () => {
    if (editingProvider) {
      onUpdateProvider(editingProvider)
      setEditingProvider(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-5xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-2xl font-semibold">Settings</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6">
          <button
            onClick={() => setActiveTab('providers')}
            className={cn(
              'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'providers'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <div className="flex items-center gap-2">
              <SettingsIcon className="w-4 h-4" />
              Providers & Models
            </div>
          </button>
          <button
            onClick={() => setActiveTab('plugins')}
            className={cn(
              'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'plugins'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Plugins
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'providers' ? (
            <div className="space-y-6">
              {/* Provider Selection */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Provider</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {providers.map((provider) => (
                    <div
                      key={provider.type}
                      className={cn(
                        'p-4 border rounded-lg cursor-pointer transition-colors',
                        selectedProvider?.type === provider.type
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      )}
                      onClick={() => {
                        onSelectProvider(provider)
                        onLoadModels(provider)
                      }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-semibold">{provider.name}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {provider.baseUrl}
                          </div>
                        </div>
                        {testResults[provider.type] !== undefined && (
                          <div>
                            {testResults[provider.type] === null ? (
                              <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                            ) : testResults[provider.type] ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-destructive" />
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingProvider(provider)
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleTestConnection(provider)
                          }}
                        >
                          Test
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Model Selection */}
              {selectedProvider && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">Model</h3>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onLoadModels(selectedProvider)}
                      disabled={isLoadingModels}
                    >
                      {isLoadingModels ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Refresh
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {models.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        No models available. Make sure the provider is running.
                      </div>
                    ) : (
                      models.map((model) => (
                        <div
                          key={model.name}
                          className={cn(
                            'p-3 border rounded-lg cursor-pointer transition-colors',
                            selectedModel === model.name
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          )}
                          onClick={() => onSelectModel(model.name)}
                        >
                          <div className="font-medium">{model.name}</div>
                          {model.size && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Size: {model.size}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <PluginManager
              plugins={plugins}
              onEnablePlugin={onEnablePlugin}
              onDisablePlugin={onDisablePlugin}
            />
          )}
        </div>

        {/* Edit Provider Modal */}
        {editingProvider && (
          <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Edit {editingProvider.name}</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Name</label>
                  <Input
                    value={editingProvider.name}
                    onChange={(e) =>
                      setEditingProvider({ ...editingProvider, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Base URL</label>
                  <Input
                    value={editingProvider.baseUrl}
                    onChange={(e) =>
                      setEditingProvider({ ...editingProvider, baseUrl: e.target.value })
                    }
                    placeholder="http://localhost:11434"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button onClick={handleSaveProvider} className="flex-1">
                    Save
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setEditingProvider(null)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
