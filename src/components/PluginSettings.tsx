import { Plug, Check, X } from 'lucide-react'
import { Button } from './ui/Button'
import type { Plugin } from '../plugins/core'
import { cn } from '../lib/utils'

interface PluginSettingsProps {
  plugins: Plugin[]
  onEnable: (pluginId: string) => void
  onDisable: (pluginId: string) => void
}

export function PluginSettings({ plugins, onEnable, onDisable }: PluginSettingsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Plug className="w-5 h-5" />
        <h3 className="text-lg font-semibold">Plugins</h3>
        <span className="text-sm text-muted-foreground">
          ({plugins.filter(p => p.metadata.enabled).length}/{plugins.length} enabled)
        </span>
      </div>

      <div className="space-y-3">
        {plugins.map((plugin) => (
          <div
            key={plugin.metadata.id}
            className={cn(
              'p-4 border rounded-lg transition-colors',
              plugin.metadata.enabled
                ? 'border-primary bg-primary/5'
                : 'border-border'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold">{plugin.metadata.name}</h4>
                  <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    v{plugin.metadata.version}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                    {plugin.metadata.type}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {plugin.metadata.description}
                </p>
                {plugin.metadata.author && (
                  <p className="text-xs text-muted-foreground mt-2">
                    by {plugin.metadata.author}
                  </p>
                )}
              </div>
              {plugin.metadata.core ? (
                <div className="ml-4 px-3 py-1.5 text-xs bg-primary/10 text-primary rounded">
                  Core Plugin
                </div>
              ) : (
                <Button
                  size="sm"
                  variant={plugin.metadata.enabled ? 'destructive' : 'default'}
                  onClick={() =>
                    plugin.metadata.enabled
                      ? onDisable(plugin.metadata.id)
                      : onEnable(plugin.metadata.id)
                  }
                  className="ml-4"
                >
                  {plugin.metadata.enabled ? (
                    <>
                      <X className="w-4 h-4 mr-1" />
                      Disable
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      Enable
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {plugins.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          No plugins installed
        </div>
      )}
    </div>
  )
}
