import { useState, useEffect, useCallback, useRef } from 'react'
import type { ProviderConfig, ModelInfo } from '../types'
import { ProviderFactory } from '../providers'

interface ModelCache {
  models: ModelInfo[]
  timestamp: number
}

export function useProviders() {
  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig | null>(null)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  
  // Cache for model lists (5 minute TTL)
  const modelCacheRef = useRef<Record<string, ModelCache>>({})
  const MODEL_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  // Initialize default providers
  useEffect(() => {
    const defaultProviders: ProviderConfig[] = [
      ProviderFactory.getDefaultConfig('ollama'),
      ProviderFactory.getDefaultConfig('lmstudio'),
      ProviderFactory.getDefaultConfig('llamacpp'),
      ProviderFactory.getDefaultConfig('anthropic'),
      ProviderFactory.getDefaultConfig('openai'),
    ]

    // Load from localStorage if available
    const saved = localStorage.getItem('providers')
    if (saved) {
      try {
        const savedProviders = JSON.parse(saved)
        // Merge saved providers with new defaults
        const existingTypes = new Set(savedProviders.map((p: ProviderConfig) => p.type))
        const newProviders = defaultProviders.filter(p => !existingTypes.has(p.type))
        setProviders([...savedProviders, ...newProviders])
      } catch {
        setProviders(defaultProviders)
      }
    } else {
      setProviders(defaultProviders)
    }

    // Load selected provider
    const savedProvider = localStorage.getItem('selectedProvider')
    if (savedProvider) {
      try {
        setSelectedProvider(JSON.parse(savedProvider))
      } catch {
        setSelectedProvider(defaultProviders[0])
      }
    } else {
      setSelectedProvider(defaultProviders[0])
    }

    // Load selected model
    const savedModel = localStorage.getItem('selectedModel')
    if (savedModel && savedModel !== 'llama.cpp-model') {
      setSelectedModel(savedModel)
    } else {
      // Clear invalid model from localStorage
      localStorage.removeItem('selectedModel')
      setSelectedModel('')
    }
  }, [])

  // Save to localStorage when providers change
  useEffect(() => {
    if (providers.length > 0) {
      localStorage.setItem('providers', JSON.stringify(providers))
    }
  }, [providers])

  useEffect(() => {
    if (selectedProvider) {
      localStorage.setItem('selectedProvider', JSON.stringify(selectedProvider))
    }
  }, [selectedProvider])

  useEffect(() => {
    if (selectedModel) {
      localStorage.setItem('selectedModel', selectedModel)
    }
  }, [selectedModel])

  const loadModels = useCallback(async (providerConfig: ProviderConfig, forceRefresh = false) => {
    const cacheKey = `${providerConfig.type}-${providerConfig.baseUrl}`
    const now = Date.now()
    
    console.log(`📋 Loading models for ${providerConfig.name} (${providerConfig.type})`, { forceRefresh, baseUrl: providerConfig.baseUrl })
    
    // Check cache first
    if (!forceRefresh) {
      const cached = modelCacheRef.current[cacheKey]
      if (cached && (now - cached.timestamp) < MODEL_CACHE_TTL) {
        console.log(`✅ Using cached models for ${providerConfig.name}:`, cached.models.length, 'models')
        setModels(cached.models)
        
        // Auto-select first model if needed
        const isCurrentModelAvailable = cached.models.some(m => m.name === selectedModel)
        if (cached.models.length > 0 && (!selectedModel || !isCurrentModelAvailable)) {
          setSelectedModel(cached.models[0].name)
        }
        return
      }
    }
    
    setIsLoadingModels(true)
    try {
      const provider = ProviderFactory.createProvider(providerConfig)
      console.log(`🔍 Fetching models from ${providerConfig.name}...`)
      const modelList = await provider.listModels()
      console.log(`✅ Received ${modelList.length} models from ${providerConfig.name}:`, modelList.map(m => m.name))
      
      // Update cache
      modelCacheRef.current[cacheKey] = {
        models: modelList,
        timestamp: now
      }
      
      setModels(modelList)
      
      // Check if currently selected model is still available
      const isCurrentModelAvailable = modelList.some(m => m.name === selectedModel)
      
      if (modelList.length > 0) {
        if (!selectedModel || !isCurrentModelAvailable) {
          // Auto-select first model if none selected or current is unavailable
          setSelectedModel(modelList[0].name)
        }
      } else {
        // No models available - clear selection
        setSelectedModel('')
      }
    } catch (error) {
      console.error('Failed to load models:', error)
      setModels([])
      setSelectedModel('') // Clear selection on error
    } finally {
      setIsLoadingModels(false)
    }
  }, [selectedModel, MODEL_CACHE_TTL])

  const testProvider = useCallback(async (providerConfig: ProviderConfig): Promise<boolean> => {
    try {
      const provider = ProviderFactory.createProvider(providerConfig)
      return await provider.testConnection()
    } catch (error) {
      console.error('Provider test failed:', error)
      return false
    }
  }, [])

  const updateProvider = useCallback((config: ProviderConfig) => {
    setProviders(prev => 
      prev.map(p => p.type === config.type ? config : p)
    )
  }, [])

  const addProvider = useCallback((config: ProviderConfig) => {
    setProviders(prev => [...prev, config])
  }, [])

  const isModelAvailable = useCallback((modelName: string): boolean => {
    return models.some(m => m.name === modelName)
  }, [models])

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
    isModelAvailable,
  }
}
