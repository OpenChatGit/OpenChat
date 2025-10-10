import { useState } from 'react'
import { Package, ExternalLink, Info, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'
import type { Plugin } from '../plugins/types'
import { cn } from '../lib/utils'

interface PluginManagerProps {
  plugins: Plugin[]
  onEnablePlugin: (pluginId: string) => void
  onDisablePlugin: (pluginId: string) => void
}

export function PluginManager({
  plugins,
  onEnablePlugin,
  onDisablePlugin,
}: PluginManagerProps) {
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null)
  const [corePluginsExpanded, setCorePluginsExpanded] = useState(true)
  const [externalPluginsExpanded, setExternalPluginsExpanded] = useState(true)

  const corePlugins = plugins.filter(p => p.metadata.core)
  const externalPlugins = plugins.filter(p => !p.metadata.core)

  const handleToggle = (plugin: Plugin) => {
    if (plugin.metadata.core) {
      return // Core plugins cannot be disabled
    }

    if (plugin.metadata.enabled) {
      onDisablePlugin(plugin.metadata.id)
    } else {
      onEnablePlugin(plugin.metadata.id)
    }
  }

  const PluginCard = ({ plugin }: { plugin: Plugin }) => {
    const isSelected = selectedPlugin?.metadata.id === plugin.metadata.id
    const canToggle = !plugin.metadata.core

    return (
      <div
        className={cn(
          'p-4 border rounded-lg cursor-pointer transition-all',
          isSelected
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50'
        )}
        onClick={() => setSelectedPlugin(plugin)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-primary flex-shrink-0" />
              <h4 className="font-semibold truncate">{plugin.metadata.name}</h4>
              {plugin.metadata.core && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-primary/20 text-primary">
                  Core
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {plugin.metadata.description}
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span>v{plugin.metadata.version}</span>
              <span>•</span>
              <span>{plugin.metadata.type}</span>
              {plugin.metadata.author && (
                <>
                  <span>•</span>
                  <span>{plugin.metadata.author}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleToggle(plugin)
              }}
              disabled={!canToggle}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                plugin.metadata.enabled ? 'bg-primary' : 'bg-muted',
                !canToggle && 'opacity-50 cursor-not-allowed'
              )}
              title={plugin.metadata.core ? 'Core plugins cannot be disabled' : 'Toggle plugin'}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full transition-transform',
                  plugin.metadata.enabled ? 'bg-gray-600 translate-x-6' : 'bg-white translate-x-1'
                )}
              />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      {/* Plugin List */}
      <div className="lg:col-span-2 space-y-6 overflow-y-auto pr-2 min-h-0">
        {/* Core Plugins */}
        <div>
          <button
            onClick={() => setCorePluginsExpanded(!corePluginsExpanded)}
            className="w-full text-lg font-semibold mb-3 flex items-center gap-2 hover:text-foreground/80 transition-colors"
          >
            {corePluginsExpanded ? (
              <ChevronDown className="w-5 h-5 text-primary" />
            ) : (
              <ChevronRight className="w-5 h-5 text-primary" />
            )}
            <Package className="w-5 h-5 text-primary" />
            Core Plugins
            <span className="text-sm text-muted-foreground font-normal">
              ({corePlugins.length})
            </span>
          </button>
          {corePluginsExpanded && (
            <div className="space-y-3">
              {corePlugins.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8 border border-dashed border-border rounded-lg">
                  No core plugins installed
                </div>
              ) : (
                corePlugins.map((plugin) => (
                  <PluginCard key={plugin.metadata.id} plugin={plugin} />
                ))
              )}
            </div>
          )}
        </div>

        {/* External Plugins */}
        <div>
          <button
            onClick={() => setExternalPluginsExpanded(!externalPluginsExpanded)}
            className="w-full text-lg font-semibold mb-3 flex items-center gap-2 hover:text-foreground/80 transition-colors"
          >
            {externalPluginsExpanded ? (
              <ChevronDown className="w-5 h-5 text-primary" />
            ) : (
              <ChevronRight className="w-5 h-5 text-primary" />
            )}
            <ExternalLink className="w-5 h-5 text-primary" />
            External Plugins
            <span className="text-sm text-muted-foreground font-normal">
              ({externalPlugins.length})
            </span>
          </button>
          {externalPluginsExpanded && (
            <div className="space-y-3">
              {externalPlugins.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8 border border-dashed border-border rounded-lg">
                  <p className="mb-2">No external plugins installed</p>
                  <p className="text-xs">
                    Add plugins to <code className="bg-muted px-1 py-0.5 rounded">src/plugins/external/</code>
                  </p>
                </div>
              ) : (
                externalPlugins.map((plugin) => (
                  <PluginCard key={plugin.metadata.id} plugin={plugin} />
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Plugin Details */}
      <div className="lg:col-span-1">
        <div className="sticky top-0">
          {selectedPlugin ? (
            <div className="border border-border rounded-lg p-4 space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-1">{selectedPlugin.metadata.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedPlugin.metadata.description}
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version:</span>
                  <span className="font-medium">{selectedPlugin.metadata.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium capitalize">{selectedPlugin.metadata.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Author:</span>
                  <span className="font-medium">{selectedPlugin.metadata.author || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className={cn(
                    'font-medium',
                    selectedPlugin.metadata.enabled ? 'text-green-500' : 'text-muted-foreground'
                  )}>
                    {selectedPlugin.metadata.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                {selectedPlugin.metadata.core && (
                  <div className="flex items-start gap-2 p-2 bg-primary/10 rounded-md">
                    <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-primary">
                      This is a core plugin and cannot be disabled
                    </span>
                  </div>
                )}
              </div>

              {selectedPlugin.metadata.homepage && (
                <a
                  href={selectedPlugin.metadata.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Documentation
                </a>
              )}

              {selectedPlugin.metadata.dependencies && selectedPlugin.metadata.dependencies.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Dependencies:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {selectedPlugin.metadata.dependencies.map((dep) => (
                      <li key={dep} className="flex items-center gap-2">
                        <AlertCircle className="w-3 h-3" />
                        {dep}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedPlugin.metadata.type === 'tool' && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Available Tools:</h4>
                  <div className="space-y-2">
                    {(() => {
                      const plugin = selectedPlugin as any
                      const tools = plugin.tools || []
                      
                      // Debug: Log what we're seeing
                      console.log('Plugin:', selectedPlugin.metadata.name)
                      console.log('Has tools property:', 'tools' in plugin)
                      console.log('Tools array:', tools)
                      console.log('Tools length:', tools.length)
                      
                      if (tools.length === 0) {
                        return (
                          <p className="text-xs text-muted-foreground italic">
                            No tools defined (reload app if you just updated the plugin)
                          </p>
                        )
                      }
                      
                      return tools.map((tool: any) => (
                        <div key={tool.function?.name || Math.random()} className="p-2 bg-muted/50 rounded-md">
                          <div className="flex items-center gap-2 mb-1">
                            <code className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">
                              {`{${tool.function?.name || 'unknown'}}`}
                            </code>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {tool.function?.description || 'No description'}
                          </p>
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="border border-dashed border-border rounded-lg p-8 text-center text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Select a plugin to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
