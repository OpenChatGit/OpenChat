import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Eye, Brain } from 'lucide-react'
import type { ProviderConfig, ModelInfo } from '../types'
import { cn } from '../lib/utils'
import { ProviderHealthMonitor, type ProviderHealthStatus } from '../services/ProviderHealthMonitor'

interface ModelSelectorProps {
  providers: ProviderConfig[]
  selectedProvider: ProviderConfig | null
  selectedModel: string
  models: ModelInfo[]
  onSelectProvider: (provider: ProviderConfig) => void
  onSelectModel: (model: string) => void
  onLoadModels: (provider: ProviderConfig) => void
  openUpwards?: boolean
  isLoadingModels?: boolean
  onCapabilitiesChange?: (capabilities: ModelInfo['capabilities']) => void
}

export function ModelSelector({
  providers,
  selectedProvider,
  selectedModel,
  models,
  onSelectProvider,
  onSelectModel,
  onLoadModels,
  openUpwards = true,
  isLoadingModels = false,
  onCapabilitiesChange,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<Map<string, ProviderHealthStatus>>(new Map())
  const dropdownRef = useRef<HTMLDivElement>(null)
  const healthMonitor = ProviderHealthMonitor.getInstance()

  // Load initial status from monitor on mount
  useEffect(() => {
    const initialStatus = healthMonitor.getAllStatuses()
    setConnectionStatus(initialStatus)
  }, [healthMonitor])

  // Subscribe to monitor updates
  useEffect(() => {
    const unsubscribe = healthMonitor.subscribe((statuses) => {
      setConnectionStatus(new Map(statuses))
    })

    return unsubscribe
  }, [healthMonitor])

  // Trigger checks when dropdown opens if cache is stale
  useEffect(() => {
    if (!isOpen) return

    const needsRefresh = providers.some(provider => {
      const status = healthMonitor.getStatus(provider.type)
      return !status || !healthMonitor.isCacheValid(status)
    })

    if (needsRefresh) {
      healthMonitor.checkProviders(providers, { timeout: 2000 })
    }
  }, [isOpen, providers, healthMonitor])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // When opening and no models yet, trigger a load for the selected provider
  useEffect(() => {
    if (!isOpen) return
    if (models.length === 0 && selectedProvider) {
      onLoadModels(selectedProvider)
    }
  }, [isOpen, models.length, selectedProvider, onLoadModels])

  // Notify parent of capability changes when selected model changes
  useEffect(() => {
    if (!onCapabilitiesChange) return
    
    const currentModel = models.find(m => m.name === selectedModel)
    onCapabilitiesChange(currentModel?.capabilities)
  }, [selectedModel, models, onCapabilitiesChange])

  const handleProviderClick = (provider: ProviderConfig) => {
    onSelectProvider(provider)
    onLoadModels(provider)
  }

  const handleModelClick = (model: string) => {
    onSelectModel(model)
    setIsOpen(false)
  }

  const renderStatusIndicator = (provider: ProviderConfig) => {
    const status = connectionStatus.get(provider.type)
    
    return (
      <div 
        className={cn(
          "w-1.5 h-1.5 rounded-full mt-1 transition-all",
          status?.checking && "animate-pulse"
        )}
        style={{ 
          backgroundColor: 
            status?.status === true ? '#10B981' :   // Green
            status?.status === false ? '#EF4444' :  // Red
            '#6B7280'                                // Gray (unknown)
        }}
      />
    )
  }

  const getProviderIcon = (type: string) => {
    switch (type) {
      case 'ollama':
        return (
          <svg fill="currentColor" height="20" width="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ minWidth: '20px', minHeight: '20px' }}>
            <path d="M7.905 1.09c.216.085.411.225.588.41.295.306.544.744.734 1.263.191.522.315 1.1.362 1.68a5.054 5.054 0 012.049-.636l.051-.004c.87-.07 1.73.087 2.48.474.101.053.2.11.297.17.05-.569.172-1.134.36-1.644.19-.52.439-.957.733-1.264a1.67 1.67 0 01.589-.41c.257-.1.53-.118.796-.042.401.114.745.368 1.016.737.248.337.434.769.561 1.287.23.934.27 2.163.115 3.645l.053.04.026.019c.757.576 1.284 1.397 1.563 2.35.435 1.487.216 3.155-.534 4.088l-.018.021.002.003c.417.762.67 1.567.724 2.4l.002.03c.064 1.065-.2 2.137-.814 3.19l-.007.01.01.024c.472 1.157.62 2.322.438 3.486l-.006.039a.651.651 0 01-.747.536.648.648 0 01-.54-.742c.167-1.033.01-2.069-.48-3.123a.643.643 0 01.04-.617l.004-.006c.604-.924.854-1.83.8-2.72-.046-.779-.325-1.544-.8-2.273a.644.644 0 01.18-.886l.009-.006c.243-.159.467-.565.58-1.12a4.229 4.229 0 00-.095-1.974c-.205-.7-.58-1.284-1.105-1.683-.595-.454-1.383-.673-2.38-.61a.653.653 0 01-.632-.371c-.314-.665-.772-1.141-1.343-1.436a3.288 3.288 0 00-1.772-.332c-1.245.099-2.343.801-2.67 1.686a.652.652 0 01-.61.425c-1.067.002-1.893.252-2.497.703-.522.39-.878.935-1.066 1.588a4.07 4.07 0 00-.068 1.886c.112.558.331 1.02.582 1.269l.008.007c.212.207.257.53.109.785-.36.622-.629 1.549-.673 2.44-.05 1.018.186 1.902.719 2.536l.016.019a.643.643 0 01.095.69c-.576 1.236-.753 2.252-.562 3.052a.652.652 0 01-1.269.298c-.243-1.018-.078-2.184.473-3.498l.014-.035-.008-.012a4.339 4.339 0 01-.598-1.309l-.005-.019a5.764 5.764 0 01-.177-1.785c.044-.91.278-1.842.622-2.59l.012-.026-.002-.002c-.293-.418-.51-.953-.63-1.545l-.005-.024a5.352 5.352 0 01.093-2.49c.262-.915.777-1.701 1.536-2.269.06-.045.123-.09.186-.132-.159-1.493-.119-2.73.112-3.67.127-.518.314-.95.562-1.287.27-.368.614-.622 1.015-.737.266-.076.54-.059.797.042zm4.116 9.09c.936 0 1.8.313 2.446.855.63.527 1.005 1.235 1.005 1.94 0 .888-.406 1.58-1.133 2.022-.62.377-1.463.577-2.318.577-.855 0-1.698-.2-2.318-.577-.727-.442-1.133-1.134-1.133-2.022 0-.705.375-1.413 1.005-1.94.646-.542 1.51-.855 2.446-.855zm-2.727 2.795c0 .387.203.737.584.99.394.262.937.41 1.543.41.606 0 1.149-.148 1.543-.41.381-.253.584-.603.584-.99 0-.387-.203-.737-.584-.99-.394-.262-.937-.41-1.543-.41-.606 0-1.149.148-1.543.41-.381.253-.584.603-.584.99z"/>
          </svg>
        )
      case 'lmstudio':
        return (
          <svg fill="currentColor" height="20" width="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ minWidth: '20px', minHeight: '20px' }}>
            <path d="M2.84 2a1.273 1.273 0 100 2.547h10.287a1.274 1.274 0 000-2.547H2.84zM7.935 5.33a1.273 1.273 0 000 2.548H18.22a1.274 1.274 0 000-2.547H7.935zM3.624 9.935c0-.704.57-1.274 1.274-1.274h10.286a1.273 1.273 0 010 2.547H4.898c-.703 0-1.274-.57-1.274-1.273zM1.273 12.188a1.273 1.273 0 100 2.547H11.56a1.274 1.274 0 000-2.547H1.273zM3.624 16.792c0-.704.57-1.274 1.274-1.274h10.286a1.273 1.273 0 110 2.547H4.898c-.703 0-1.274-.57-1.274-1.273zM13.029 18.849a1.273 1.273 0 100 2.547h5.78a1.273 1.273 0 100-2.547h-5.78z"/>
          </svg>
        )
      case 'anthropic':
        return (
          <svg fill="currentColor" height="20" width="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ minWidth: '20px', minHeight: '20px' }}>
            <path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 9.959L8.453 7.687 6.205 13.48H10.7z"/>
          </svg>
        )
      case 'openai':
        return (
          <svg fill="currentColor" height="20" width="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ minWidth: '20px', minHeight: '20px' }}>
            <path d="M21.55 10.004a5.416 5.416 0 00-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.59 5.59 0 0010.831 1C8.39.995 6.224 2.546 5.473 4.838A5.553 5.553 0 001.76 7.496a5.487 5.487 0 00.691 6.5 5.416 5.416 0 00.477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.586 5.586 0 0013.168 23c2.443.006 4.61-1.546 5.361-3.84a5.553 5.553 0 003.715-2.66 5.488 5.488 0 00-.693-6.497v.001zm-8.381 11.558a4.199 4.199 0 01-2.675-.954c.034-.018.093-.05.132-.074l4.44-2.53a.71.71 0 00.364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 01-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.068.068 0 01-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 015.198 6.41l-.002.151v5.06a.711.711 0 00.364.624l5.42 3.087-1.876 1.07a.067.067 0 01-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h.001zm15.417 3.54l-5.42-3.088L14.896 7.6a.067.067 0 01.063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 01-2.174 1.807V12.38a.71.71 0 00-.363-.623zm1.867-2.773a6.04 6.04 0 00-.132-.078l-4.44-2.53a.731.731 0 00-.729 0l-5.42 3.088V7.325a.068.068 0 01.027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757h.001zm-11.741 3.81l-1.877-1.068a.065.065 0 01-.036-.051V6.559c.001-2.277 1.873-4.122 4.181-4.12.976 0 1.92.338 2.671.954-.034.018-.092.05-.131.073l-4.44 2.53a.71.71 0 00-.365.623l-.003 6.173v.002zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z"/>
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Model Selector Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 px-3 rounded-full flex items-center gap-2 transition-all hover:bg-white/10"
      >
        <span className="text-xs text-gray-300">
          {selectedModel && selectedModel.trim() !== '' && selectedModel !== 'llama.cpp-model' && models.some(m => m.name === selectedModel) ? selectedModel : 'Select Model'}
        </span>
        <ChevronDown className={cn(
          "w-3 h-3 text-gray-400 transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div 
          className={cn(
            "absolute left-0 rounded-2xl shadow-2xl overflow-hidden z-50",
            openUpwards ? "bottom-full mb-2" : "top-full mt-2"
          )}
          style={{ 
            backgroundColor: '#2C2C2E',
            minWidth: '300px',
            maxHeight: '400px'
          }}
        >
          {/* Provider Icons Bar */}
          <div className="flex items-center justify-center gap-2 p-3 border-b" style={{ borderColor: '#3A3A3C' }}>
            {providers.map((provider) => {
              const icon = getProviderIcon(provider.type)
              if (!icon) return null
              
              return (
                <div key={provider.type} className="relative flex flex-col items-center">
                  <button
                    onClick={() => handleProviderClick(provider)}
                    className={cn(
                      "p-2 rounded-lg transition-all flex items-center justify-center",
                      selectedProvider?.type === provider.type
                        ? "bg-white/20"
                        : "hover:bg-white/10"
                    )}
                    title={provider.name}
                  >
                    {icon}
                  </button>
                  {/* Connection Status Indicator */}
                  {renderStatusIndicator(provider)}
                </div>
              )
            })}
          </div>

          {/* Models List */}
          <div className="max-h-80 overflow-y-auto">
            {isLoadingModels ? (
              <div className="p-4 text-center text-gray-500 text-sm">Loading models…</div>
            ) : models.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">No models available</div>
            ) : (
              <div className="p-2">
                {models.map((model) => {
                  const hasVision = model.capabilities?.vision ?? false
                  const hasReasoning = model.capabilities?.reasoning ?? false
                  
                  // Build tooltip text
                  const tooltipParts = []
                  if (hasVision) tooltipParts.push('Supports image analysis')
                  if (hasReasoning) tooltipParts.push('Supports reasoning')
                  const tooltip = tooltipParts.length > 0 ? tooltipParts.join(' • ') : undefined
                  
                  return (
                    <button
                      key={model.name}
                      onClick={() => handleModelClick(model.name)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg text-sm transition-all",
                        selectedModel === model.name
                          ? "bg-white/20 text-white"
                          : "text-gray-300 hover:bg-white/10"
                      )}
                      title={tooltip}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <div className="font-medium">{model.name}</div>
                          {model.size && (
                            <div className="text-xs text-gray-500 mt-0.5">{model.size}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {hasVision && (
                            <Eye 
                              className="w-4 h-4 text-blue-400" 
                              aria-label="Supports image analysis"
                            />
                          )}
                          {hasReasoning && (
                            <Brain 
                              className="w-4 h-4 text-purple-400" 
                              aria-label="Supports reasoning"
                            />
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
