import { useState, useEffect, useCallback } from 'react'
import type { ProviderConfig, ModelInfo } from '../types'
import { ProviderFactory } from '../providers'
import { loadLocal, saveLocal, isValidProviderConfig } from '../lib/utils'
import { setApiKey, getApiKey, removeApiKey } from '../lib/secureStorage'

export function useProviders() {
  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig | null>(null)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [isLoadingModels, setIsLoadingModels] = useState(false)

  // Initialize default providers
  useEffect(() => {
    const defaultProviders: ProviderConfig[] = [
      ProviderFactory.getDefaultConfig('ollama'),
      ProviderFactory.getDefaultConfig('lmstudio'),
      ProviderFactory.getDefaultConfig('llamacpp'),
      ProviderFactory.getDefaultConfig('openai'),
      ProviderFactory.getDefaultConfig('anthropic'),
      ProviderFactory.getDefaultConfig('openrouter'),
    ]

    // Load from localStorage if available
    const saved = loadLocal<any>('providers', null)
    let loadedProviders: ProviderConfig[]
    
    if (saved) {
      const parsed = Array.isArray(saved) ? saved.filter(isValidProviderConfig) as ProviderConfig[] : []
      const existingTypes = new Set(parsed.map((p: ProviderConfig) => p.type))
      const newProviders = defaultProviders.filter(p => !existingTypes.has(p.type))
      loadedProviders = [...parsed, ...newProviders]
    } else {
      loadedProviders = defaultProviders
    }
    
    // Hydrate API keys from secure storage
    loadedProviders = loadedProviders.map(provider => {
      const apiKey = getApiKey(provider.type)
      return apiKey ? { ...provider, apiKey } : provider
    })
    
    setProviders(loadedProviders)

    // Load selected provider
    const savedProvider = loadLocal<ProviderConfig | null>('selectedProvider', null)
    if (savedProvider && isValidProviderConfig(savedProvider)) {
      // Hydrate API key for selected provider
      const apiKey = getApiKey(savedProvider.type)
      setSelectedProvider(apiKey ? { ...savedProvider, apiKey } : savedProvider)
    } else {
      setSelectedProvider(loadedProviders[0])
    }

    // Load selected model (normalize previously double-encoded values)
    const rawModel = loadLocal<any>('selectedModel', null)
    const normalize = (val: any): string => {
      if (typeof val !== 'string') return ''
      let s = val.trim()
      // If it looks like a JSON string with quotes/backslashes, try to parse once
      if ((s.startsWith('"') && s.endsWith('"')) || s.includes('\\')) {
        try { s = JSON.parse(s) } catch {}
      }
      return s
    }
    const nm = normalize(rawModel)
    if (nm && nm !== 'llama.cpp-model') {
      setSelectedModel(nm)
      // Persist normalized form to avoid future escapes
      saveLocal('selectedModel', nm)
    } else {
      saveLocal('selectedModel', '')
      setSelectedModel('')
    }
  }, [])

  // Save to localStorage when providers change (without API keys)
  useEffect(() => {
    if (providers.length > 0) {
      // Remove API keys before saving to localStorage
      const providersWithoutKeys = providers.map(({ apiKey, ...rest }) => rest)
      saveLocal('providers', providersWithoutKeys)
      
      // Save or remove API keys from secure storage
      providers.forEach(provider => {
        if (provider.apiKey) {
          setApiKey(provider.type, provider.apiKey)
        } else {
          // Remove API key if it's empty (user cleared it)
          removeApiKey(provider.type)
        }
      })
    }
  }, [providers])

  useEffect(() => {
    if (selectedProvider) {
      // Remove API key before saving to localStorage
      const { apiKey, ...providerWithoutKey } = selectedProvider
      saveLocal('selectedProvider', providerWithoutKey)
      
      // Save or remove API key from secure storage
      if (apiKey) {
        setApiKey(selectedProvider.type, apiKey)
      } else {
        // Remove API key if it's empty (user cleared it)
        removeApiKey(selectedProvider.type)
      }
    }
  }, [selectedProvider])

  // Hydrate models from cache immediately on provider selection for better UX after refresh
  useEffect(() => {
    if (!selectedProvider) return
    const cache = loadLocal<Record<string, ModelInfo[]>>('oc.modelCache', {})
    const allCached = cache[selectedProvider.type]
    if (allCached && allCached.length > 0) {
      // Filter out hidden models from cache
      const hiddenModels = selectedProvider.hiddenModels || []
      const visibleCached = allCached.filter(m => !hiddenModels.includes(m.name))
      setModels(visibleCached)
      
      // Validate that the selected model exists in the visible cached list
      if (selectedModel) {
        const modelExists = visibleCached.some(m => m.name === selectedModel)
        if (!modelExists) {
          // Selected model doesn't exist in visible cache, clear it
          setSelectedModel('')
          saveLocal('selectedModel', '')
        }
      }
    } else {
      // No cached models, clear selected model
      if (selectedModel) {
        setSelectedModel('')
        saveLocal('selectedModel', '')
      }
    }
  }, [selectedProvider, selectedProvider?.hiddenModels, selectedModel])

  useEffect(() => {
    if (selectedModel) {
      saveLocal('selectedModel', selectedModel)
    }
  }, [selectedModel])

  const loadModels = useCallback(async (providerConfig: ProviderConfig) => {
    setIsLoadingModels(true)
    try {
      // Temporarily remove hiddenModels to get ALL models from provider
      const tempProvider = { ...providerConfig, hiddenModels: [] }
      const provider = ProviderFactory.createProvider(tempProvider)
      const allModels = await provider.listModels()
      
      // Filter out hidden models for display
      const hiddenModels = providerConfig.hiddenModels || []
      const visibleModels = allModels.filter(m => !hiddenModels.includes(m.name))
      setModels(visibleModels)

      // Update cache with ALL models (not filtered) for fast restore after refresh
      const cache = loadLocal<Record<string, ModelInfo[]>>('oc.modelCache', {})
      cache[providerConfig.type] = allModels
      saveLocal('oc.modelCache', cache)
      
      // Validate that the currently selected model exists in the visible list
      if (selectedModel) {
        const modelExists = visibleModels.some(m => m.name === selectedModel)
        if (!modelExists) {
          // Selected model doesn't exist in visible models or is hidden, clear it
          setSelectedModel('')
          saveLocal('selectedModel', '')
        }
      }
      
      // Auto-select first model if none selected and visible models are available
      if (visibleModels.length > 0 && !selectedModel) {
        setSelectedModel(visibleModels[0].name)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // Gracefully handle unsupported providers
      if (errorMessage.includes('Unsupported provider type')) {
        console.warn(`Provider ${providerConfig.type} is not yet implemented`)
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('ERR_CONNECTION_REFUSED')) {
        console.warn(`Provider ${providerConfig.name} is not reachable at ${providerConfig.baseUrl}`)
      } else {
        console.error('Failed to load models:', error)
      }
      
      setModels([])
      // Clear selected model if loading fails
      if (selectedModel) {
        setSelectedModel('')
        saveLocal('selectedModel', '')
      }
    } finally {
      setIsLoadingModels(false)
    }
  }, [selectedModel])

  const testProvider = useCallback(async (providerConfig: ProviderConfig): Promise<boolean> => {
    try {
      const provider = ProviderFactory.createProvider(providerConfig)
      return await provider.testConnection()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // Gracefully handle unsupported providers
      if (errorMessage.includes('Unsupported provider type')) {
        console.warn(`Provider ${providerConfig.type} is not yet implemented`)
      } else {
        console.warn(`Provider test failed for ${providerConfig.name}:`, errorMessage)
      }
      
      return false
    }
  }, [])

  const updateProvider = useCallback((config: ProviderConfig) => {
    setProviders(prev => 
      prev.map(p => p.type === config.type ? config : p)
    )
    
    // Also update selectedProvider if it's the same provider
    setSelectedProvider(prev => 
      prev && prev.type === config.type ? config : prev
    )
  }, [])

  const addProvider = useCallback((config: ProviderConfig) => {
    setProviders(prev => [...prev, config])
  }, [])

  return {
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
    addProvider,
  }
}
