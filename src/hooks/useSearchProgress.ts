/**
 * useSearchProgress - React hook for consuming search progress events
 * 
 * This hook subscribes to search events from AutoSearchManager and provides
 * real-time progress updates for the UI.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AutoSearchManager } from '../lib/web-search/autoSearchManager';
import type { SearchEvent } from '../lib/web-search/searchEvents';

// ============================================================================
// Progress State Types
// ============================================================================

export interface SearchProgress {
  isSearching: boolean;
  phase: 'idle' | 'searching' | 'scraping' | 'processing' | 'completed' | 'error';
  query: string | null;
  
  // Search phase
  searchResultCount: number;
  searchResults: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  
  // Scraping phase
  scrapingProgress: {
    completed: number;
    total: number;
    currentUrl: string | null;
  };
  
  // Processing phase
  processingInfo: {
    totalChunks: number;
    selectedChunks: number;
    sources: number;
  };
  
  // Completion
  totalTime: number;
  error: string | null;
}

const INITIAL_PROGRESS: SearchProgress = {
  isSearching: false,
  phase: 'idle',
  query: null,
  searchResultCount: 0,
  searchResults: [],
  scrapingProgress: {
    completed: 0,
    total: 0,
    currentUrl: null
  },
  processingInfo: {
    totalChunks: 0,
    selectedChunks: 0,
    sources: 0
  },
  totalTime: 0,
  error: null
};

// ============================================================================
// Hook
// ============================================================================

export function useSearchProgress(autoSearchManager: AutoSearchManager | null) {
  const [progress, setProgress] = useState<SearchProgress>(INITIAL_PROGRESS);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Handle search events
  const handleSearchEvent = useCallback((event: SearchEvent) => {
    switch (event.type) {
      case 'search_started':
        setProgress({
          ...INITIAL_PROGRESS,
          isSearching: true,
          phase: 'searching',
          query: event.data.query
        });
        break;

      case 'search_results_found':
        setProgress(prev => ({
          ...prev,
          searchResultCount: event.data.resultCount,
          searchResults: event.data.results
        }));
        break;

      case 'scraping_started':
        setProgress(prev => ({
          ...prev,
          phase: 'scraping',
          scrapingProgress: {
            completed: 0,
            total: event.data.urlCount,
            currentUrl: event.data.urls[0] || null
          }
        }));
        break;

      case 'scraping_progress':
        setProgress(prev => ({
          ...prev,
          scrapingProgress: {
            completed: event.data.completed,
            total: event.data.total,
            currentUrl: event.data.currentUrl
          }
        }));
        break;

      case 'scraping_completed':
        setProgress(prev => ({
          ...prev,
          scrapingProgress: {
            ...prev.scrapingProgress,
            completed: prev.scrapingProgress.total
          }
        }));
        break;

      case 'processing_started':
        setProgress(prev => ({
          ...prev,
          phase: 'processing'
        }));
        break;

      case 'processing_completed':
        setProgress(prev => ({
          ...prev,
          processingInfo: {
            totalChunks: event.data.totalChunks,
            selectedChunks: event.data.selectedChunks,
            sources: event.data.sources
          }
        }));
        break;

      case 'search_completed':
        setProgress(prev => ({
          ...prev,
          isSearching: false,
          phase: 'completed',
          totalTime: event.data.totalTime
        }));
        
        // Reset to idle after a delay
        setTimeout(() => {
          setProgress(prev => 
            prev.phase === 'completed' 
              ? { ...INITIAL_PROGRESS } 
              : prev
          );
        }, 3000);
        break;

      case 'search_error':
        setProgress(prev => ({
          ...prev,
          isSearching: false,
          phase: 'error',
          error: event.data.error
        }));
        
        // Reset to idle after a delay
        setTimeout(() => {
          setProgress(prev => 
            prev.phase === 'error' 
              ? { ...INITIAL_PROGRESS } 
              : prev
          );
        }, 5000);
        break;
    }
  }, []);

  // Subscribe to events
  useEffect(() => {
    if (!autoSearchManager) {
      return;
    }

    // Subscribe to all events
    unsubscribeRef.current = autoSearchManager.onAny(handleSearchEvent);

    // Cleanup
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [autoSearchManager, handleSearchEvent]);

  // Reset progress manually
  const resetProgress = useCallback(() => {
    setProgress(INITIAL_PROGRESS);
  }, []);

  return {
    progress,
    resetProgress
  };
}

// ============================================================================
// Helper Hooks
// ============================================================================

/**
 * Hook to get formatted progress message
 */
export function useSearchProgressMessage(progress: SearchProgress): string {
  if (!progress.isSearching && progress.phase === 'idle') {
    return '';
  }

  switch (progress.phase) {
    case 'searching':
      return `🔍 Searching for: ${progress.query}...`;

    case 'scraping':
      const { completed, total } = progress.scrapingProgress;
      return `📄 Scraping content (${completed}/${total})...`;

    case 'processing':
      return `⚙️ Processing results...`;

    case 'completed':
      const { selectedChunks, sources } = progress.processingInfo;
      const time = (progress.totalTime / 1000).toFixed(1);
      return `✅ Found ${selectedChunks} relevant sections from ${sources} source(s) in ${time}s`;

    case 'error':
      return `❌ Search failed: ${progress.error}`;

    default:
      return '';
  }
}

/**
 * Hook to get progress percentage (0-100)
 */
export function useSearchProgressPercentage(progress: SearchProgress): number {
  if (!progress.isSearching) {
    return progress.phase === 'completed' ? 100 : 0;
  }

  switch (progress.phase) {
    case 'searching':
      return 10;

    case 'scraping':
      const { completed, total } = progress.scrapingProgress;
      if (total === 0) return 30;
      // Scraping is 30-70% of progress
      return 30 + (completed / total) * 40;

    case 'processing':
      return 80;

    case 'completed':
      return 100;

    default:
      return 0;
  }
}
