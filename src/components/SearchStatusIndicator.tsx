/**
 * SearchStatusIndicator Component
 * 
 * Displays the status of web search operations with animated progress indicators.
 * Shows different states: searching, found results, scraping content, and completion.
 * Supports streaming updates for real-time progress display.
 */

import { useEffect, useState } from 'react'
import type { Message } from '../types'
import type { SearchProgress } from '../hooks/useSearchProgress'

interface SearchStatusIndicatorProps {
  message: Message
  streamingProgress?: SearchProgress | null
}

export function SearchStatusIndicator({ message, streamingProgress }: SearchStatusIndicatorProps) {
  const [dots, setDots] = useState('')
  const [progress, setProgress] = useState(0)

  // Animate dots for loading states
  useEffect(() => {
    if (message.status === 'searching' || streamingProgress?.isSearching) {
      const interval = setInterval(() => {
        setDots(prev => (prev.length >= 3 ? '' : prev + '.'))
      }, 500)

      return () => clearInterval(interval)
    }
  }, [message.status, streamingProgress?.isSearching])

  // Update progress from streaming or animate
  useEffect(() => {
    if (streamingProgress?.isSearching) {
      // Use streaming progress
      const { phase, scrapingProgress } = streamingProgress
      
      switch (phase) {
        case 'searching':
          setProgress(20)
          break
        case 'scraping':
          const scrapingPercent = scrapingProgress.total > 0
            ? (scrapingProgress.completed / scrapingProgress.total) * 60
            : 30
          setProgress(20 + scrapingPercent)
          break
        case 'processing':
          setProgress(90)
          break
        case 'completed':
          setProgress(100)
          break
      }
    } else if (message.status === 'searching') {
      // Fallback to animated progress
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev
          return prev + Math.random() * 10
        })
      }, 300)

      return () => clearInterval(interval)
    } else if (message.metadata?.autoSearch) {
      // Complete the progress bar
      setProgress(100)
    }
  }, [message.status, message.metadata?.autoSearch, streamingProgress])

  // Don't render if not a search-related message
  if (message.status !== 'searching' && !message.metadata?.autoSearch) {
    return null
  }

  const autoSearch = message.metadata?.autoSearch

  // Searching state with streaming progress
  if ((message.status === 'searching' || streamingProgress?.isSearching) && !autoSearch) {
    const statusText = streamingProgress?.isSearching
      ? getStreamingStatusText(streamingProgress, dots)
      : `Searching the web${dots}`

    return (
      <div className="px-4 py-2">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col gap-2">
            {/* Status text with animated dots */}
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="relative flex items-center justify-center w-4 h-4">
                <div className="absolute w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <span>{statusText}</span>
            </div>
            
            {/* Progress bar */}
            <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>

            {/* Show search results preview if available */}
            {streamingProgress?.searchResults && streamingProgress.searchResults.length > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                Found {streamingProgress.searchResultCount} results, scraping content...
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Completion state - show results
  if (autoSearch) {
    const hasResults = autoSearch.chunkCount > 0
    const searchTimeSeconds = (autoSearch.searchTime / 1000).toFixed(1)

    return (
      <div className="px-4 py-2">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col gap-2">
            {/* Status text */}
            <div className="flex items-center gap-2 text-sm">
              {hasResults ? (
                <>
                  <div className="flex items-center justify-center w-4 h-4">
                    <svg 
                      className="w-4 h-4 text-green-500" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M5 13l4 4L19 7" 
                      />
                    </svg>
                  </div>
                  <span className="text-green-400">
                    Found {autoSearch.chunkCount} relevant section{autoSearch.chunkCount !== 1 ? 's' : ''} from {autoSearch.sources.length} source{autoSearch.sources.length !== 1 ? 's' : ''} in {searchTimeSeconds}s
                  </span>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center w-4 h-4">
                    <svg 
                      className="w-4 h-4 text-yellow-500" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                      />
                    </svg>
                  </div>
                  <span className="text-yellow-400">
                    Search completed but no relevant results found
                  </span>
                </>
              )}
            </div>

            {/* Sources list (if results found) */}
            {hasResults && autoSearch.sources.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1">
                {autoSearch.sources.slice(0, 3).map((source, index) => (
                  <a
                    key={index}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
                    title={source.title}
                  >
                    <svg 
                      className="w-3 h-3 text-gray-400" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                      />
                    </svg>
                    <span className="text-gray-300 truncate max-w-[200px]">
                      {source.domain}
                    </span>
                  </a>
                ))}
                {autoSearch.sources.length > 3 && (
                  <span className="flex items-center px-2 py-1 text-xs text-gray-400">
                    +{autoSearch.sources.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}

/**
 * Get status text based on streaming progress
 */
function getStreamingStatusText(progress: SearchProgress, dots: string): string {
  switch (progress.phase) {
    case 'searching':
      return `Searching for: ${progress.query}${dots}`
    
    case 'scraping':
      const { completed, total } = progress.scrapingProgress
      return `Scraping content (${completed}/${total})${dots}`
    
    case 'processing':
      return `Processing results${dots}`
    
    case 'completed':
      return 'Search completed'
    
    case 'error':
      return `Search failed: ${progress.error}`
    
    default:
      return `Searching${dots}`
  }
}
