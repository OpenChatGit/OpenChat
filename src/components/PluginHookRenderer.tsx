/**
 * Plugin Hook Renderer
 * 
 * This component executes plugin hooks and renders their results.
 * It makes it super easy to add plugin extension points anywhere in the UI.
 * 
 * Features:
 * - Supports multiple hook result types (string, JSX, objects)
 * - Error boundaries for plugin UI
 * - Proper React rendering with keys
 * - Graceful error handling
 */

import { useEffect, useState, Component, type ReactNode, isValidElement } from 'react'
import { pluginHooks, type HookType } from '../plugins/core/PluginHooks'
import type { Message } from '../types'

interface PluginHookRendererProps {
  hookType: HookType
  message?: Message
  [key: string]: any
}

// ============================================================================
// Error Boundary for Plugin UI
// ============================================================================

interface ErrorBoundaryProps {
  children: ReactNode
  pluginId?: string
  hookType: HookType
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

class PluginErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error(
      `[PluginHookRenderer] Error in plugin UI for hook ${this.props.hookType}:`,
      error,
      errorInfo
    )
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-xs text-red-400 mt-1 p-2 rounded bg-red-900/20 border border-red-800/30">
          Plugin error: {this.state.error?.message || 'Unknown error'}
        </div>
      )
    }

    return this.props.children
  }
}

// ============================================================================
// Hook Result Renderer
// ============================================================================

interface HookResultProps {
  result: any
  hookType: HookType
}

function HookResult({ result, hookType }: HookResultProps) {
  if (result === null || result === undefined) return null

  // Handle different result types
  try {
    // 1. Handle string results
    if (typeof result === 'string') {
      return (
        <div className="text-xs text-gray-500 mt-1 mr-2">
          {result}
        </div>
      )
    }

    // 2. Handle number and boolean primitives
    if (typeof result === 'number' || typeof result === 'boolean') {
      return (
        <div className="text-xs text-gray-500 mt-1 mr-2">
          {String(result)}
        </div>
      )
    }

    // 3. Handle React elements (JSX) - use React's isValidElement
    if (isValidElement(result)) {
      return <div>{result}</div>
    }

    // 4. Handle arrays of results (recursive rendering)
    if (Array.isArray(result)) {
      return (
        <>
          {result.map((item, idx) => (
            <HookResult key={idx} result={item} hookType={hookType} />
          ))}
        </>
      )
    }

    // 5. Handle object with type property (plugin result objects)
    if (typeof result === 'object' && result !== null && typeof result.type === 'string') {
      switch (result.type) {
        case 'timestamp':
          return (
            <div className="text-xs text-gray-500 mt-1 mr-2">
              {result.content}
            </div>
          )

        case 'custom':
          // Handle custom components or elements
          if (result.element && isValidElement(result.element)) {
            return <div>{result.element}</div>
          }
          if (result.component && typeof result.component === 'function') {
            const Component = result.component
            return <Component {...(result.props || {})} />
          }
          console.warn(`[PluginHookRenderer] Custom type requires 'element' or 'component' property`)
          break

        case 'button':
          return (
            <button
              onClick={result.onClick}
              className={result.className || 'px-3 py-1 text-sm rounded bg-white/10 hover:bg-white/20 transition-colors'}
              title={result.title}
              disabled={result.disabled}
            >
              {result.label || result.content}
            </button>
          )

        case 'badge':
          return (
            <span className={result.className || 'px-2 py-0.5 text-xs rounded bg-blue-500/20 text-blue-300'}>
              {result.content}
            </span>
          )

        case 'text':
          return (
            <div 
              className={result.className || 'text-xs text-gray-500 mt-1'}
              style={result.style}
            >
              {result.content}
            </div>
          )

        case 'html':
          // Render raw HTML (use with caution)
          return (
            <div
              className={result.className}
              dangerouslySetInnerHTML={{ __html: result.content }}
            />
          )

        case 'link':
          return (
            <a
              href={result.href}
              className={result.className || 'text-xs text-blue-400 hover:text-blue-300 underline mt-1 mr-2'}
              target={result.target || '_blank'}
              rel={result.rel || 'noopener noreferrer'}
              title={result.title}
            >
              {result.label || result.content}
            </a>
          )

        case 'icon':
          return (
            <span className={result.className || 'inline-block w-4 h-4 mr-1'} title={result.title}>
              {result.content || result.icon}
            </span>
          )

        case 'container':
          // Container for grouping multiple elements
          return (
            <div className={result.className || 'flex items-center gap-2 mt-1'}>
              {result.children && Array.isArray(result.children) && (
                <>
                  {result.children.map((child: any, idx: number) => (
                    <HookResult key={idx} result={child} hookType={hookType} />
                  ))}
                </>
              )}
            </div>
          )

        default:
          console.warn(`[PluginHookRenderer] Unknown result type: ${result.type}`)
          return null
      }
    }

    // 6. Handle plain objects (log warning and skip rendering)
    if (typeof result === 'object') {
      console.warn(`[PluginHookRenderer] Unhandled object result for ${hookType}:`, result)
      return null
    }

    return null
  } catch (error) {
    console.error(`[PluginHookRenderer] Error rendering result for ${hookType}:`, error)
    return (
      <div className="text-xs text-red-400 mt-1 p-2 rounded bg-red-900/20 border border-red-800/30">
        Error rendering plugin result
      </div>
    )
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function PluginHookRenderer({ hookType, message, ...context }: PluginHookRendererProps) {
  const [results, setResults] = useState<any[]>([])
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const executeHooks = async () => {
      try {
        setError(null)
        const hookResults = await pluginHooks.execute(hookType, { message, ...context })
        setResults(hookResults)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        console.error(`[PluginHookRenderer] Error executing hooks for ${hookType}:`, error)
        setError(error)
      }
    }

    executeHooks()
  }, [hookType, message, JSON.stringify(context)])

  // Show error if hook execution failed
  if (error) {
    return (
      <div className="text-xs text-red-400 mt-1 p-2 rounded bg-red-900/20 border border-red-800/30">
        Plugin hook error: {error.message}
      </div>
    )
  }

  // No results, render nothing
  if (results.length === 0) return null

  return (
    <>
      {results.map((result, index) => (
        <PluginErrorBoundary key={`${hookType}-${index}`} hookType={hookType}>
          <HookResult result={result} hookType={hookType} />
        </PluginErrorBoundary>
      ))}
    </>
  )
}
