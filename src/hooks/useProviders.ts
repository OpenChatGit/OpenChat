import { useState, useEffect, useCallback } from 'react'
import type { ProviderConfig, ModelInfo } from '../types'
import { ProviderFactory } from '../providers'

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

  const loadModels = useCallback(async (providerConfig: ProviderConfig) => {
    setIsLoadingModels(true)
    try {
      const provider = ProviderFactory.createProvider(providerConfig)
      const modelList = await provider.listModels()
      setModels(modelList)
      
      // Auto-select first model if none selected
      if (modelList.length > 0 && !selectedModel) {
        setSelectedModel(modelList[0].name)
      }
    } catch (error) {
      console.error('Failed to load models:', error)
      setModels([])
    } finally {
      setIsLoadingModels(false)
    }
  }, [selectedModel])

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
