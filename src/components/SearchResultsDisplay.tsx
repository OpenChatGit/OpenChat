/**
 * SearchResultsDisplay Component
 * 
 * Displays detailed web search results with expandable source information.
 * Shows sources list with URLs, titles, domains, publish dates, chunk count, and search time.
 */

import { useState } from 'react'
import type { Message } from '../types'

interface SearchResultsDisplayProps {
  message: Message
}

export function SearchResultsDisplay({ message }: SearchResultsDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Only render if message has autoSearch metadata
  const autoSearch = message.metadata?.autoSearch
  if (!autoSearch || autoSearch.sources.length === 0) {
    return null
  }

  const { sources, chunkCount, searchTime, query } = autoSearch
  const searchTimeSeconds = (searchTime / 1000).toFixed(1)

  return (
    <div className="px-4 py-2">
      <div className="max-w-3xl mx-auto">
        <div className="rounded-lg bg-gray-800/50 border border-gray-700 overflow-hidden">
          {/* Header with summary info */}
          <div className="px-4 py-3 border-b border-gray-700">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <svg 
                    className="w-4 h-4 text-blue-400 flex-shrink-0" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                    />
                  </svg>
                  <h3 className="text-sm font-medium text-gray-200">
                    Web Search Results
                  </h3>
                </div>
                <p className="text-xs text-gray-400 truncate">
                  Query: {query}
                </p>
              </div>
              
              {/* Stats */}
              <div className="flex items-center gap-3 text-xs text-gray-400 flex-shrink-0">
                <div className="flex items-center gap-1">
                  <svg 
                    className="w-3.5 h-3.5" 
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
                  <span>{chunkCount} chunk{chunkCount !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg 
                    className="w-3.5 h-3.5" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                    />
                  </svg>
                  <span>{searchTimeSeconds}s</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sources preview (always visible) */}
          <div className="px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {sources.slice(0, 3).map((source, index) => (
                <a
                  key={index}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-700/50 hover:bg-gray-700 rounded-md transition-colors group"
                  title={source.title}
                >
                  <svg 
                    className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-300 flex-shrink-0" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" 
                    />
                  </svg>
                  <span className="text-xs text-gray-300 group-hover:text-gray-100 truncate max-w-[180px]">
                    {source.domain}
                  </span>
                </a>
              ))}
              {sources.length > 3 && (
                <span className="flex items-center px-3 py-1.5 text-xs text-gray-400">
                  +{sources.length - 3} more
                </span>
              )}
            </div>
          </div>

          {/* Show Details toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-4 py-2 flex items-center justify-center gap-2 text-xs text-gray-400 hover:text-gray-300 hover:bg-gray-700/30 transition-colors border-t border-gray-700"
          >
            <span>{isExpanded ? 'Hide Details' : 'Show Details'}</span>
            <svg 
              className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M19 9l-7 7-7-7" 
              />
            </svg>
          </button>

          {/* Expanded details */}
          {isExpanded && (
            <div className="border-t border-gray-700 bg-gray-800/30">
              <div className="px-4 py-3">
                <h4 className="text-xs font-medium text-gray-300 mb-3">
                  All Sources ({sources.length})
                </h4>
                <div className="space-y-2">
                  {sources.map((source, index) => (
                    <div
                      key={index}
                      className="p-3 bg-gray-700/30 rounded-md hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-blue-400 hover:text-blue-300 hover:underline line-clamp-2"
                          >
                            {source.title}
                          </a>
                        </div>
                        {source.publishedDate && (
                          <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                            <svg 
                              className="w-3 h-3" 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={2} 
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" 
                              />
                            </svg>
                            <span>
                              {new Date(source.publishedDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{source.domain}</span>
                        <span className="text-gray-600">•</span>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-500 hover:text-gray-400 truncate flex-1 min-w-0"
                        >
                          {source.url}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
