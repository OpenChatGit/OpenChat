import { useState } from 'react'
import { Settings, RefreshCw, Trash2, ExternalLink } from 'lucide-react'
import type { PluginMetadata } from '../plugins/core'
import { cn } from '../lib/utils'

interface PluginCardProps {
  plugin: PluginMetadata
  onEnable: (pluginId: string) => void
  onDisable: (pluginId: string) => void
  onConfigure?: (pluginId: string) => void
  onReload?: (pluginId: string) => void
  onUninstall?: (pluginId: string) => void
}

export function PluginCard({
  plugin,
  onEnable,
  onDisable,
  onConfigure,
  onReload,
  onUninstall
}: PluginCardProps) {
  const [isToggling, setIsToggling] = useState(false)

  const handleToggle = async () => {
    setIsToggling(true)
    try {
      if (plugin.enabled) {
        await onDisable(plugin.id)
      } else {
        await onEnable(plugin.id)
      }
    } finally {
      setIsToggling(false)
    }
  }

  // Get plugin type tags
  const types = Array.isArray(plugin.type) ? plugin.type : [plugin.type]
  
  // Get status color
  const getStatusColor = () => {
    if (plugin.error) return 'text-red-400'
    if (!plugin.loaded) return 'text-yellow-400'
    if (plugin.enabled) return 'text-white'
    return 'text-gray-400'
  }

  const getStatusText = () => {
    if (plugin.error) return 'Error'
    if (!plugin.loaded) return 'Loading'
    if (plugin.enabled) return 'Enabled'
    return 'Disabled'
  }

  return (
    <div
      className={cn(
        'p-4 rounded-lg border transition-all',
        plugin.enabled ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-sm truncate">{plugin.name}</h3>
            {plugin.core && (
              <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-primary/20 text-primary">
                Core
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {plugin.description}
          </p>
        </div>

        {/* Toggle Switch */}
        <button
          onClick={handleToggle}
          disabled={isToggling || plugin.core}
          className={cn(
            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0',
            plugin.enabled ? 'bg-white' : 'bg-gray-600',
            (isToggling || plugin.core) && 'opacity-50 cursor-not-allowed'
          )}
          title={plugin.core ? 'Core plugins cannot be disabled' : plugin.enabled ? 'Disable' : 'Enable'}
        >
          <span
            className={cn(
              'inline-block h-4 w-4 transform rounded-full transition-transform',
              plugin.enabled ? 'bg-black translate-x-5' : 'bg-white translate-x-0.5'
            )}
          />
        </button>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {types.map((type) => (
          <span
            key={type}
            className="px-2 py-0.5 text-xs font-medium rounded-full bg-secondary text-secondary-foreground"
          >
            {type}
          </span>
        ))}
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
        <div className="flex items-center gap-1">
          <span>v{plugin.version}</span>
        </div>
        <div className="flex items-center gap-1">
          <span>by {plugin.author}</span>
        </div>
        <div className={cn('flex items-center gap-1 ml-auto', getStatusColor())}>
          <div className="w-1.5 h-1.5 rounded-full bg-current" />
          <span>{getStatusText()}</span>
        </div>
      </div>

      {/* Error Message */}
      {plugin.error && (
        <div className="mb-3 p-2 rounded bg-destructive/10 border border-destructive/20">
          <p className="text-xs text-destructive">{plugin.error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Homepage Link */}
        {plugin.homepage && (
          <a
            href={plugin.homepage}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            title="Homepage"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}

        {/* Configure Button */}
        {onConfigure && plugin.config && (
          <button
            onClick={() => onConfigure(plugin.id)}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            title="Configure"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Reload Button (External plugins only) */}
        {onReload && !plugin.isBuiltin && (
          <button
            onClick={() => onReload(plugin.id)}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            title="Reload Plugin"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Uninstall Button (External plugins only) */}
        {onUninstall && !plugin.isBuiltin && (
          <button
            onClick={() => onUninstall(plugin.id)}
            className="p-1.5 rounded hover:bg-red-500/10 text-red-400 transition-colors ml-auto"
            title="Uninstall"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
