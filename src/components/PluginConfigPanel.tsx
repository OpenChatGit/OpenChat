/**
 * Plugin Configuration Panel
 * 
 * Dynamically generates form fields from plugin config schema
 * and handles validation and saving via pluginAPI.
 */

import { useState, useEffect } from 'react'
import { Save, RotateCcw, X } from 'lucide-react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Checkbox } from './ui/Checkbox'
import { Slider } from './ui/Slider'
import type { PluginMetadata } from '../plugins/core/types'
import type { ConfigField, ConfigSchema } from '../plugins/api/ConfigAPI'
import { cn } from '../lib/utils'

export interface PluginConfigPanelProps {
  plugin: PluginMetadata
  onClose: () => void
  onSave?: (pluginId: string, config: Record<string, any>) => void
}

export function PluginConfigPanel({ plugin, onClose, onSave }: PluginConfigPanelProps) {
  const [config, setConfig] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Load initial config from localStorage
  useEffect(() => {
    loadConfig()
  }, [plugin.id])

  /**
   * Load config from localStorage
   */
  const loadConfig = () => {
    try {
      const storageKey = `oc.plugin.config.${plugin.id}`
      const stored = localStorage.getItem(storageKey)
      
      if (stored) {
        setConfig(JSON.parse(stored))
      } else {
        // Use defaults from schema
        setConfig(getDefaults())
      }
    } catch (error) {
      console.error('Failed to load plugin config:', error)
      setConfig(getDefaults())
    }
  }

  /**
   * Get default values from schema
   */
  const getDefaults = (): Record<string, any> => {
    const defaults: Record<string, any> = {}
    const schema = plugin.config as ConfigSchema
    
    if (schema) {
      for (const [key, field] of Object.entries(schema)) {
        if (field.default !== undefined) {
          defaults[key] = field.default
        }
      }
    }
    
    return defaults
  }

  /**
   * Validate a single field
   */
  const validateField = (key: string, value: any): string | null => {
    const schema = plugin.config as ConfigSchema
    if (!schema || !schema[key]) return null

    const field = schema[key]

    // Type validation
    switch (field.type) {
      case 'string':
        if (typeof value !== 'string') {
          return 'Must be a string'
        }
        break

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return 'Must be a number'
        }
        // Min/max validation
        if (field.min !== undefined && value < field.min) {
          return `Must be at least ${field.min}`
        }
        if (field.max !== undefined && value > field.max) {
          return `Must be at most ${field.max}`
        }
        break

      case 'boolean':
        if (typeof value !== 'boolean') {
          return 'Must be a boolean'
        }
        break

      case 'select':
        if (!field.options || !field.options.includes(value)) {
          return `Must be one of: ${field.options?.join(', ')}`
        }
        break

      default:
        console.warn(`Unknown config type: ${field.type}`)
    }

    return null
  }

  /**
   * Validate all fields
   */
  const validateAll = (): boolean => {
    const schema = plugin.config as ConfigSchema
    if (!schema) return true

    const newErrors: Record<string, string> = {}
    let isValid = true

    for (const key of Object.keys(schema)) {
      const value = config[key]
      const error = validateField(key, value)
      
      if (error) {
        newErrors[key] = error
        isValid = false
      }
    }

    setErrors(newErrors)
    return isValid
  }

  /**
   * Handle field change
   */
  const handleChange = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
    
    // Clear error for this field
    setErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[key]
      return newErrors
    })
  }

  /**
   * Save config
   */
  const handleSave = async () => {
    // Validate all fields
    if (!validateAll()) {
      return
    }

    setIsSaving(true)
    try {
      // Save to localStorage
      const storageKey = `oc.plugin.config.${plugin.id}`
      localStorage.setItem(storageKey, JSON.stringify(config))
      
      // Notify parent
      if (onSave) {
        onSave(plugin.id, config)
      }

      setHasChanges(false)
      
      // Show success message
      console.log(`[PluginConfigPanel] Saved config for plugin: ${plugin.id}`)
      
      // Close panel after short delay
      setTimeout(() => {
        onClose()
      }, 500)
    } catch (error) {
      console.error('Failed to save plugin config:', error)
      setErrors({ _general: 'Failed to save configuration' })
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Reset to defaults
   */
  const handleReset = () => {
    if (confirm('Reset all settings to default values?')) {
      setConfig(getDefaults())
      setErrors({})
      setHasChanges(true)
    }
  }

  /**
   * Render a form field based on its type
   */
  const renderField = (key: string, field: ConfigField) => {
    const value = config[key] ?? field.default
    const error = errors[key]

    switch (field.type) {
      case 'string':
        return (
          <div key={key} className="space-y-2">
            <label className="text-sm font-medium block">
              {field.label}
              {field.description && (
                <span className="text-xs text-muted-foreground block mt-0.5">
                  {field.description}
                </span>
              )}
            </label>
            <Input
              value={value || ''}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder={field.default || ''}
              className={cn(error && 'border-destructive')}
            />
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>
        )

      case 'number':
        // Use slider if min/max are defined, otherwise use input
        if (field.min !== undefined && field.max !== undefined) {
          return (
            <div key={key} className="space-y-2">
              <Slider
                label={field.label}
                value={value ?? field.default ?? field.min}
                onChange={(val) => handleChange(key, val)}
                min={field.min}
                max={field.max}
                step={field.step || 1}
                showValue={true}
              />
              {field.description && (
                <p className="text-xs text-muted-foreground">{field.description}</p>
              )}
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
            </div>
          )
        } else {
          return (
            <div key={key} className="space-y-2">
              <label className="text-sm font-medium block">
                {field.label}
                {field.description && (
                  <span className="text-xs text-muted-foreground block mt-0.5">
                    {field.description}
                  </span>
                )}
              </label>
              <Input
                type="number"
                value={value ?? ''}
                onChange={(e) => handleChange(key, parseFloat(e.target.value))}
                placeholder={field.default?.toString() || ''}
                min={field.min}
                max={field.max}
                className={cn(error && 'border-destructive')}
              />
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
            </div>
          )
        }

      case 'boolean':
        return (
          <div key={key} className="space-y-2">
            <Checkbox
              checked={value ?? field.default ?? false}
              onChange={(checked) => handleChange(key, checked)}
              label={field.label}
              description={field.description}
            />
            {error && (
              <p className="text-xs text-destructive ml-8">{error}</p>
            )}
          </div>
        )

      case 'select':
        return (
          <div key={key} className="space-y-2">
            <label className="text-sm font-medium block">
              {field.label}
              {field.description && (
                <span className="text-xs text-muted-foreground block mt-0.5">
                  {field.description}
                </span>
              )}
            </label>
            <select
              value={value ?? field.default ?? ''}
              onChange={(e) => handleChange(key, e.target.value)}
              className={cn(
                'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                'ring-offset-background',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                error && 'border-destructive'
              )}
            >
              {field.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>
        )

      default:
        return (
          <div key={key} className="text-sm text-muted-foreground">
            Unsupported field type: {field.type}
          </div>
        )
    }
  }

  const schema = plugin.config as ConfigSchema

  // If no config schema, show message
  if (!schema || Object.keys(schema).length === 0) {
    return (
      <div className="fixed inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center p-6 z-50">
        <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Configure {plugin.name}</h2>
            <button
              onClick={onClose}
              className="p-2 rounded hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-muted-foreground text-center py-8">
            This plugin has no configuration options.
          </p>
          <div className="flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">Configure {plugin.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {plugin.description}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* General Error */}
        {errors._general && (
          <div className="mb-4 p-3 rounded bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">{errors._general}</p>
          </div>
        )}

        {/* Form Fields */}
        <div className="flex-1 overflow-y-auto space-y-6 mb-6">
          {Object.entries(schema).map(([key, field]) => renderField(key, field))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-border">
          <Button
            onClick={handleReset}
            variant="secondary"
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </Button>
          
          <div className="flex-1" />
          
          <Button
            onClick={onClose}
            variant="secondary"
          >
            Cancel
          </Button>
          
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}
