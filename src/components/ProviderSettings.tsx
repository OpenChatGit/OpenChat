import { useState, useEffect } from 'react'
import { Check, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Checkbox } from './ui/Checkbox'
import type { ProviderConfig, ModelInfo } from '../types'
import { cn } from '../lib/utils'

interface ProviderSettingsProps {
  provider: ProviderConfig
  selectedModel: string
  onUpdateProvider: (provider: ProviderConfig) => void
  onTestProvider: (provider: ProviderConfig) => Promise<boolean>
  onSelectModel: (model: string) => void
  onLoadModels: (provider: ProviderConfig) => void
}

export function ProviderSettings({
  provider,
  selectedModel,
  onUpdateProvider,
  onTestProvider,
  onSelectModel,
  onLoadModels,
}: ProviderSettingsProps) {
  const [editedProvider, setEditedProvider] = useState<ProviderConfig>(provider)
  const [testResult, setTestResult] = useState<boolean | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [showModelFilter, setShowModelFilter] = useState(false)
  const [modelSearchQuery, setModelSearchQuery] = useState('')
  
  // Clean model name by removing provider prefixes
  const cleanModelName = (modelName: string): string => {
    // Remove common provider prefixes
    const prefixes = [
      'anthropic/',
      'openai/',
      'openrouter/',
      'google/',
      'meta-llama/',
      'mistralai/',
      'cohere/',
      'ai21/',
      'huggingface/',
      'amazon/',
      'nvidia/',
      'perplexity/',
      'deepseek/',
      'x-ai/',
      'xai/',
      'qwen/',
      'alibaba/',
      'microsoft/',
      'meta/',
      'inflection/',
      'databricks/',
      '01-ai/',
      'cognitivecomputations/',
      'minimax/',
    ]
    
    let cleaned = modelName
    for (const prefix of prefixes) {
      if (cleaned.startsWith(prefix)) {
        cleaned = cleaned.substring(prefix.length)
        break
      }
    }
    
    return cleaned
  }
  
  // Internal state for models - each provider manages its own
  const [models, setModels] = useState<ModelInfo[]>([])
  const [allModels, setAllModels] = useState<ModelInfo[]>([]) // Unfiltered list for stats
  const [isLoadingModels, setIsLoadingModels] = useState(false)

  // Update editedProvider when provider prop changes
  useEffect(() => {
    setEditedProvider(provider)
    setHasChanges(false)
    setTestResult(null) // Clear test result when provider changes
  }, [provider])

  // Auto-test connection when component mounts or provider changes
  useEffect(() => {
    const autoTest = async () => {
      const result = await onTestProvider(provider)
      setTestResult(result)
    }
    autoTest()
  }, [provider.type]) // Only re-run when provider type changes

  // Load models when component mounts or provider changes
  useEffect(() => {
    loadModelsForProvider()
  }, [provider.type])

  const loadModelsForProvider = async () => {
    setIsLoadingModels(true)
    try {
      const { ProviderFactory } = await import('../providers')
      // Temporarily remove hiddenModels to get ALL models
      const tempProvider = { ...provider, hiddenModels: [] }
      const providerInstance = ProviderFactory.createProvider(tempProvider)
      const modelList = await providerInstance.listModels()
      setAllModels(modelList) // Store unfiltered list
      
      // Now filter for display
      const hiddenModels = provider.hiddenModels || []
      const visibleModels = modelList.filter(m => !hiddenModels.includes(m.name))
      setModels(visibleModels)
    } catch (error) {
      console.error(`Failed to load models for ${provider.name}:`, error)
      setAllModels([])
      setModels([])
    } finally {
      setIsLoadingModels(false)
    }
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)
    const result = await onTestProvider(editedProvider)
    setTestResult(result)
    setIsTesting(false)
  }

  const handleSave = () => {
    onUpdateProvider(editedProvider)
    setHasChanges(false)
  }

  const handleChange = (updates: Partial<ProviderConfig>) => {
    setEditedProvider({ ...editedProvider, ...updates })
    setHasChanges(true)
  }

  // Highlight matching text in search results
  const highlightMatch = (text: string, query: string) => {
    if (!query) return text

    const parts = text.split(new RegExp(`(${query})`, 'gi'))
    return (
      <>
        {parts.map((part, index) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={index} className="bg-yellow-500/30 text-foreground rounded px-0.5">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    )
  }

  return (
    <div className="space-y-6">
      {/* Provider Info */}
      <div className="p-4 border border-border rounded-lg bg-muted/30">
        <h3 className="text-lg font-semibold mb-2">{provider.name} Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Configure connection settings and manage models for {provider.name}
        </p>
      </div>

      {/* Connection Status */}
      {testResult !== null && (
        <div
          className={`p-4 border rounded-lg flex items-center gap-3 ${
            testResult
              ? 'border-green-500/50 bg-green-500/10'
              : 'border-destructive/50 bg-destructive/10'
          }`}
        >
          {testResult ? (
            <>
              <Check className="w-5 h-5 text-green-500" />
              <div>
                <p className="font-medium text-green-500">Connection Successful</p>
                <p className="text-sm text-muted-foreground">
                  Provider is configured correctly
                </p>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="w-5 h-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Connection Failed</p>
                <p className="text-sm text-muted-foreground">
                  Please check your settings and try again
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Settings Form */}
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Provider Name</label>
          <Input
            value={editedProvider.name}
            onChange={(e) => handleChange({ name: e.target.value })}
            placeholder="Provider Name"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Display name for this provider
          </p>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Base URL</label>
          <Input
            value={editedProvider.baseUrl}
            onChange={(e) => handleChange({ baseUrl: e.target.value })}
            placeholder="http://localhost:11434"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {provider.type === 'ollama' && 'Default: http://localhost:11434'}
            {provider.type === 'lmstudio' && 'Default: http://localhost:1234/v1'}
            {provider.type === 'openai' && 'Default: https://api.openai.com/v1'}
            {provider.type === 'anthropic' && 'Default: https://api.anthropic.com/v1'}
            {provider.type === 'openrouter' && 'Default: https://openrouter.ai'}
          </p>
        </div>

        {(provider.type === 'openai' || provider.type === 'anthropic' || provider.type === 'openrouter') && (
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
                value={editedProvider.apiKey || ''}
                onChange={(e) => handleChange({ apiKey: e.target.value })}
                placeholder="sk-..."
                className="flex-1"
              />
              {editedProvider.apiKey && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleChange({ apiKey: '' })}
                  title="Clear API Key"
                >
                  Clear
                </Button>
              )}
            </div>
            {editedProvider.apiKey && (
              <p className="text-xs text-muted-foreground mt-1">
                API Key is set. Clear and save to remove from system.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-border">
        <Button
          onClick={handleSave}
          disabled={!hasChanges}
          className="flex-1"
        >
          Save Changes
        </Button>
        <Button
          variant="secondary"
          onClick={handleTestConnection}
          disabled={isTesting}
          className="flex-1"
        >
          {isTesting ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Testing...
            </>
          ) : (
            'Test Connection'
          )}
        </Button>
      </div>

      {/* Model Selection */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Available Models</h3>
          <div className="flex gap-2">
            {(provider.type === 'openai' || provider.type === 'anthropic' || provider.type === 'openrouter') && allModels.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowModelFilter(true)}
              >
                Filter Models ({allModels.length - (provider.hiddenModels?.length || 0)}/{allModels.length})
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={loadModelsForProvider}
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
                  Refresh Models
                </>
              )}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          {models.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 border border-dashed border-border rounded-lg">
              <p className="mb-2">No models available</p>
              <p className="text-xs">
                {provider.type === 'ollama' && 'Make sure Ollama is running and has models installed'}
                {provider.type === 'lmstudio' && 'Make sure LM Studio is running with a model loaded'}
                {provider.type === 'openrouter' && 'OpenRouter provides access to 100+ models. Use the Filter Models feature to manage the list.'}
                {(provider.type === 'openai' || provider.type === 'anthropic') && 'Click "Refresh Models" to load available models'}
              </p>
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
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{cleanModelName(model.name)}</div>
                    {model.size && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Size: {model.size}
                      </div>
                    )}
                  </div>
                  {selectedModel === model.name && (
                    <Check className="w-5 h-5 text-primary" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Additional Info */}
      <div className="p-4 border border-border rounded-lg bg-muted/20">
        <h4 className="text-sm font-semibold mb-2">Provider Information</h4>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>Type:</span>
            <span className="font-medium">{provider.type}</span>
          </div>
          <div className="flex justify-between">
            <span>Current URL:</span>
            <span className="font-mono text-xs">{provider.baseUrl}</span>
          </div>
          <div className="flex justify-between">
            <span>Available Models:</span>
            <span className="font-medium">{models.length}</span>
          </div>
          {provider.type === 'ollama' && (
            <div className="mt-3 pt-3 border-t border-border space-y-3">
              <div>
                <p className="text-xs font-semibold mb-1">Command Line:</p>
                <p className="text-xs text-muted-foreground mb-1">
                  Start Ollama from the terminal:
                </p>
                <code className="block p-2 bg-muted rounded text-xs">
                  ollama serve
                </code>
              </div>
              <div>
                <p className="text-xs font-semibold mb-1">Windows App:</p>
                <p className="text-xs text-muted-foreground mb-1">
                  If using the Ollama Windows app, enable network access:
                </p>
                <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1 ml-2">
                  <li>Right-click the Ollama icon in the system tray</li>
                  <li>Go to Settings</li>
                  <li>Enable "Expose Ollama on my network"</li>
                  <li>Restart the Ollama app</li>
                </ol>
                <p className="text-xs text-muted-foreground mt-2">
                  The app will then be accessible at <code className="bg-muted px-1 rounded">http://localhost:11434</code>
                </p>
              </div>
            </div>
          )}
          {provider.type === 'lmstudio' && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs">
                Make sure LM Studio is running with the local server enabled.
              </p>
              <p className="text-xs mt-1">
                In LM Studio: Go to "Local Server" tab and click "Start Server"
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Model Filter Modal */}
      {showModelFilter && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Manage Models for {provider.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Select which models to show in the dropdown. Hidden models won't appear in the model selector.
              </p>
            </div>
            
            {/* Search Bar */}
            <div className="mb-4">
              <Input
                type="text"
                placeholder="Search models..."
                value={modelSearchQuery}
                onChange={(e) => setModelSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Stats */}
            <div className="flex justify-center gap-4 mb-4 p-3 bg-muted/50 rounded-lg">
              {modelSearchQuery && (
                <div className="text-center min-w-[100px]">
                  <div className="text-xs text-muted-foreground">Matching</div>
                  <div className="text-lg font-semibold text-blue-500">
                    {allModels.filter(m => 
                      m.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
                      m.details?.description?.toLowerCase().includes(modelSearchQuery.toLowerCase())
                    ).length}
                  </div>
                </div>
              )}
              <div className="text-center min-w-[100px]">
                <div className="text-xs text-muted-foreground">Visible</div>
                <div className="text-lg font-semibold text-green-500">
                  {(() => {
                    const hiddenModels = provider.hiddenModels || []
                    // Only count hidden models that actually exist in the current model list
                    const validHiddenCount = hiddenModels.filter(h => allModels.some(m => m.name === h)).length
                    return Math.max(0, allModels.length - validHiddenCount)
                  })()}
                </div>
              </div>
              <div className="text-center min-w-[100px]">
                <div className="text-xs text-muted-foreground">Hidden</div>
                <div className="text-lg font-semibold text-red-500">
                  {(() => {
                    const hiddenModels = provider.hiddenModels || []
                    // Only count hidden models that actually exist in the current model list
                    return hiddenModels.filter(h => allModels.some(m => m.name === h)).length
                  })()}
                </div>
              </div>
              <div className="text-center min-w-[100px]">
                <div className="text-xs text-muted-foreground">Total Models</div>
                <div className="text-lg font-semibold">{allModels.length}</div>
              </div>
            </div>

            {/* Model List */}
            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
              {allModels
                .filter(model => 
                  modelSearchQuery === '' || 
                  model.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
                  model.details?.description?.toLowerCase().includes(modelSearchQuery.toLowerCase())
                )
                .map((model) => {
                const hiddenModels = provider.hiddenModels || []
                const isHidden = hiddenModels.includes(model.name)
                
                return (
                  <div
                    key={model.name}
                    className={cn(
                      "flex items-start gap-3 p-3 border rounded-lg transition-all",
                      isHidden 
                        ? "border-border bg-muted/30 opacity-60" 
                        : "border-primary/30 bg-primary/5 hover:bg-primary/10"
                    )}
                  >
                    <Checkbox
                      checked={!isHidden}
                      onChange={(checked) => {
                        const newHiddenModels = checked
                          ? hiddenModels.filter(m => m !== model.name)
                          : [...hiddenModels, model.name]
                        
                        const updatedProvider = {
                          ...provider,
                          hiddenModels: newHiddenModels
                        }
                        onUpdateProvider(updatedProvider)
                        
                        // Reload models in parent to update ModelSelector
                        onLoadModels(updatedProvider)
                      }}
                    />
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        {highlightMatch(cleanModelName(model.name), modelSearchQuery)}
                        {isHidden && (
                          <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-500 rounded">
                            Hidden
                          </span>
                        )}
                      </div>
                      {model.details?.description && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {highlightMatch(model.details.description, modelSearchQuery)}
                        </div>
                      )}
                      {model.details?.owned_by && (
                        <div className="text-xs text-muted-foreground">
                          Provider: {model.details.owned_by}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  const updatedProvider = {
                    ...provider,
                    hiddenModels: []
                  }
                  onUpdateProvider(updatedProvider)
                  // Reload models in parent to update ModelSelector
                  onLoadModels(updatedProvider)
                }}
                variant="secondary"
              >
                Show All
              </Button>
              <Button
                onClick={() => {
                  const updatedProvider = {
                    ...provider,
                    hiddenModels: allModels.map(m => m.name)
                  }
                  onUpdateProvider(updatedProvider)
                  // Reload models in parent to update ModelSelector
                  onLoadModels(updatedProvider)
                }}
                variant="secondary"
              >
                Hide All
              </Button>
              <div className="flex-1" />
              <Button
                onClick={() => setShowModelFilter(false)}
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
