import { useState, useEffect } from 'react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Toggle } from './ui/Toggle'
import type { RAGConfig } from '../lib/web-search/types'
import { DEFAULT_RAG_CONFIG } from '../lib/web-search/types'

export interface WebSearchSettings {
  autoSearchEnabled: boolean
  maxResults: number
  cacheEnabled: boolean
  cacheTTL: number
  ragConfig: RAGConfig
}

export const DEFAULT_WEB_SEARCH_SETTINGS: WebSearchSettings = {
  autoSearchEnabled: false,
  maxResults: 5,
  cacheEnabled: true,
  cacheTTL: 3600000, // 1 hour
  ragConfig: DEFAULT_RAG_CONFIG
}

interface WebSearchSettingsProps {
  settings?: WebSearchSettings
  onUpdateSettings?: (settings: WebSearchSettings) => void
}

export function WebSearchSettings({
  settings = DEFAULT_WEB_SEARCH_SETTINGS,
  onUpdateSettings
}: WebSearchSettingsProps) {
  const [localSettings, setLocalSettings] = useState<WebSearchSettings>(settings)

  // Sync local settings with props
  useEffect(() => {
    setLocalSettings(settings)
  }, [settings])

  const updateSetting = <K extends keyof WebSearchSettings>(
    key: K,
    value: WebSearchSettings[K]
  ) => {
    const newSettings = { ...localSettings, [key]: value }
    setLocalSettings(newSettings)
    onUpdateSettings?.(newSettings)
  }

  const updateRAGConfig = <K extends keyof RAGConfig>(
    key: K,
    value: RAGConfig[K]
  ) => {
    const newRAGConfig = { ...localSettings.ragConfig, [key]: value }
    const newSettings = { ...localSettings, ragConfig: newRAGConfig }
    setLocalSettings(newSettings)
    onUpdateSettings?.(newSettings)
  }

  const resetSettings = () => {
    setLocalSettings(DEFAULT_WEB_SEARCH_SETTINGS)
    onUpdateSettings?.(DEFAULT_WEB_SEARCH_SETTINGS)
  }

  return (
    <div className="space-y-6">
      {/* Header with Reset Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Web Search Configuration</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Configure automatic web search and RAG processing
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={resetSettings}
        >
          Reset to Defaults
        </Button>
      </div>

      {/* Basic Settings */}
      <div className="space-y-4 p-4 border border-border rounded-lg">
        <h4 className="text-sm font-semibold">Basic Settings</h4>
        
        {/* Auto-Search Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium">Auto Web Search</label>
            <p className="text-xs text-muted-foreground mt-1">
              Automatically search the web when helpful
            </p>
          </div>
          <Toggle
            checked={localSettings.autoSearchEnabled}
            onChange={(checked) => updateSetting('autoSearchEnabled', checked)}
          />
        </div>

        {/* Max Results Slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Max Results</label>
            <span className="text-sm text-muted-foreground">{localSettings.maxResults}</span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            value={localSettings.maxResults}
            onChange={(e) => updateSetting('maxResults', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-600 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
            style={{
              accentColor: 'var(--color-primary)'
            }}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Number of search results to retrieve
          </p>
        </div>

        {/* Cache Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium">Enable Cache</label>
            <p className="text-xs text-muted-foreground mt-1">
              Cache search results for faster responses
            </p>
          </div>
          <Toggle
            checked={localSettings.cacheEnabled}
            onChange={(checked) => updateSetting('cacheEnabled', checked)}
          />
        </div>
      </div>

      {/* RAG Configuration */}
      <div className="space-y-4 p-4 border border-border rounded-lg">
        <div>
          <h4 className="text-sm font-semibold">RAG Configuration</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Configure how content is processed and ranked
          </p>
        </div>
        
        {/* Chunk Size Slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Chunk Size</label>
            <span className="text-sm text-muted-foreground">{localSettings.ragConfig.chunkSize}</span>
          </div>
          <input
            type="range"
            min="500"
            max="2000"
            step="100"
            value={localSettings.ragConfig.chunkSize}
            onChange={(e) => updateRAGConfig('chunkSize', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-600 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
            style={{
              accentColor: 'var(--color-primary)'
            }}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Characters per content chunk (500-2000)
          </p>
        </div>

        {/* Max Chunks Slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Max Chunks</label>
            <span className="text-sm text-muted-foreground">{localSettings.ragConfig.maxChunks}</span>
          </div>
          <input
            type="range"
            min="3"
            max="20"
            value={localSettings.ragConfig.maxChunks}
            onChange={(e) => updateRAGConfig('maxChunks', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-600 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
            style={{
              accentColor: 'var(--color-primary)'
            }}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Maximum chunks to include in context (3-20)
          </p>
        </div>

        {/* Recency Weight Slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Recency Weight</label>
            <span className="text-sm text-muted-foreground">{localSettings.ragConfig.recencyWeight.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={localSettings.ragConfig.recencyWeight}
            onChange={(e) => updateRAGConfig('recencyWeight', parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-600 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
            style={{
              accentColor: 'var(--color-primary)'
            }}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Weight for newer content (0.0-1.0)
          </p>
        </div>

        {/* Quality Weight Slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Quality Weight</label>
            <span className="text-sm text-muted-foreground">{localSettings.ragConfig.qualityWeight.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={localSettings.ragConfig.qualityWeight}
            onChange={(e) => updateRAGConfig('qualityWeight', parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-600 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
            style={{
              accentColor: 'var(--color-primary)'
            }}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Weight for content quality (0.0-1.0)
          </p>
        </div>

        {/* Trusted Domains Input */}
        <div>
          <label className="text-sm font-medium mb-2 block">Trusted Domains</label>
          <Input
            value={localSettings.ragConfig.trustedDomains.join(', ')}
            onChange={(e) => {
              const domains = e.target.value
                .split(',')
                .map(d => d.trim())
                .filter(d => d.length > 0)
              updateRAGConfig('trustedDomains', domains)
            }}
            placeholder="wikipedia.org, github.com, stackoverflow.com"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Comma-separated list of preferred domains
          </p>
        </div>
      </div>
    </div>
  )
}
