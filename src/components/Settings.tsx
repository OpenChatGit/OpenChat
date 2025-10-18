import { useState } from 'react'
import { Check, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import type { ProviderConfig, ModelInfo } from '../types'
import { cn } from '../lib/utils'

interface SettingsProps {
  providers: ProviderConfig[]
  selectedProvider: ProviderConfig | null
  models: ModelInfo[]
  selectedModel: string
  isLoadingModels: boolean
  onClose?: () => void
  onSelectProvider: (provider: ProviderConfig) => void
  onSelectModel: (model: string) => void
  onUpdateProvider: (provider: ProviderConfig) => void
  onTestProvider: (provider: ProviderConfig) => Promise<boolean>
  onLoadModels: (provider: ProviderConfig) => void
}

export function Settings({
  providers,
  selectedProvider,
  models,
  selectedModel,
  isLoadingModels,
  onSelectProvider,
  onSelectModel,
  onUpdateProvider,
  onTestProvider,
  onLoadModels,
}: SettingsProps) {
  const [editingProvider, setEditingProvider] = useState<ProviderConfig | null>(null)
  const [testResults, setTestResults] = useState<Record<string, boolean | null>>({})
  const [showModelFilter, setShowModelFilter] = useState(false)

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
                          <Check className="w-4 h-4 text-white" />
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
                <div className="flex gap-2">
                  {(selectedProvider.type === 'openai' || selectedProvider.type === 'anthropic') && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setShowModelFilter(true)}
                    >
                      Filter Models
                    </Button>
                  )}
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
      {/* Edit Provider Modal */}
      {editingProvider && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center p-6 z-50">
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
              {(editingProvider.type === 'openai' || editingProvider.type === 'anthropic') && (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    API Key
                    <span className="text-xs text-muted-foreground ml-2">
                      (stored securely, never exposed)
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      value={editingProvider.apiKey || ''}
                      onChange={(e) =>
                        setEditingProvider({ ...editingProvider, apiKey: e.target.value })
                      }
                      placeholder="sk-..."
                      className="flex-1"
                    />
                    {editingProvider.apiKey && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setEditingProvider({ ...editingProvider, apiKey: '' })
                        }}
                        title="Clear API Key"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  {editingProvider.apiKey && (
                    <p className="text-xs text-muted-foreground mt-1">
                      API Key is set. Clear and save to remove from system.
                    </p>
                  )}
                </div>
              )}
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

      {/* Model Filter Modal - Improved UI */}
      {showModelFilter && selectedProvider && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Manage Models for {selectedProvider.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Select which models to show in the dropdown. Hidden models won't appear in the model selector.
              </p>
            </div>
            
            {/* Stats */}
            <div className="flex gap-4 mb-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">Total Models</div>
                <div className="text-lg font-semibold">{models.length}</div>
              </div>
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">Visible</div>
                <div className="text-lg font-semibold text-green-500">
                  {models.length - (selectedProvider.hiddenModels?.length || 0)}
                </div>
              </div>
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">Hidden</div>
                <div className="text-lg font-semibold text-red-500">
                  {selectedProvider.hiddenModels?.length || 0}
                </div>
              </div>
            </div>

            {/* Model List */}
            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
              {models.map((model) => {
                const hiddenModels = selectedProvider.hiddenModels || []
                const isHidden = hiddenModels.includes(model.name)
                
                return (
                  <label
                    key={model.name}
                    className={cn(
                      "flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all",
                      isHidden 
                        ? "border-border bg-muted/30 opacity-60" 
                        : "border-primary/30 bg-primary/5 hover:bg-primary/10"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={!isHidden}
                      onChange={(e) => {
                        const newHiddenModels = e.target.checked
                          ? hiddenModels.filter(m => m !== model.name)
                          : [...hiddenModels, model.name]
                        
                        const updatedProvider = {
                          ...selectedProvider,
                          hiddenModels: newHiddenModels
                        }
                        onUpdateProvider(updatedProvider)
                      }}
                      className="w-5 h-5 rounded border-gray-300"
                    />
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        {model.name}
                        {isHidden && (
                          <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-500 rounded">
                            Hidden
                          </span>
                        )}
                      </div>
                      {model.details?.description && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {model.details.description}
                        </div>
                      )}
                      {model.details?.owned_by && (
                        <div className="text-xs text-muted-foreground">
                          Provider: {model.details.owned_by}
                        </div>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  // Show all models
                  const updatedProvider = {
                    ...selectedProvider,
                    hiddenModels: []
                  }
                  onUpdateProvider(updatedProvider)
                }}
                variant="secondary"
                className="flex-1"
              >
                Show All
              </Button>
              <Button
                onClick={() => setShowModelFilter(false)}
                className="flex-1"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
