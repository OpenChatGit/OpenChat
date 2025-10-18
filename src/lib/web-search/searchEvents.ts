/**
 * SearchEvents - Event-based system for streaming search progress updates
 * 
 * This module provides an event emitter for real-time search progress updates,
 * allowing the UI to display progressive results as they become available.
 */

// ============================================================================
// Event Types
// ============================================================================

export type SearchEventType =
  | 'search_started'
  | 'search_results_found'
  | 'scraping_started'
  | 'scraping_progress'
  | 'scraping_completed'
  | 'processing_started'
  | 'processing_completed'
  | 'search_completed'
  | 'search_error';

export interface SearchEvent {
  type: SearchEventType;
  timestamp: number;
  data?: any;
}

export interface SearchStartedEvent extends SearchEvent {
  type: 'search_started';
  data: {
    query: string;
    maxResults: number;
  };
}

export interface SearchResultsFoundEvent extends SearchEvent {
  type: 'search_results_found';
  data: {
    resultCount: number;
    results: Array<{
      title: string;
      url: string;
      snippet: string;
    }>;
  };
}

export interface ScrapingStartedEvent extends SearchEvent {
  type: 'scraping_started';
  data: {
    urlCount: number;
    urls: string[];
  };
}

export interface ScrapingProgressEvent extends SearchEvent {
  type: 'scraping_progress';
  data: {
    completed: number;
    total: number;
    currentUrl: string;
    success: boolean;
  };
}

export interface ScrapingCompletedEvent extends SearchEvent {
  type: 'scraping_completed';
  data: {
    successCount: number;
    failureCount: number;
    totalTime: number;
  };
}

export interface ProcessingStartedEvent extends SearchEvent {
  type: 'processing_started';
  data: {
    contentCount: number;
  };
}

export interface ProcessingCompletedEvent extends SearchEvent {
  type: 'processing_completed';
  data: {
    totalChunks: number;
    selectedChunks: number;
    sources: number;
  };
}

export interface SearchCompletedEvent extends SearchEvent {
  type: 'search_completed';
  data: {
    query: string;
    totalTime: number;
    chunkCount: number;
    sourceCount: number;
  };
}

export interface SearchErrorEvent extends SearchEvent {
  type: 'search_error';
  data: {
    error: string;
    phase: 'search' | 'scraping' | 'processing';
  };
}

// ============================================================================
// Event Listener Type
// ============================================================================

export type SearchEventListener = (event: SearchEvent) => void;

// ============================================================================
// SearchEventEmitter Class
// ============================================================================

export class SearchEventEmitter {
  private listeners: Map<SearchEventType, Set<SearchEventListener>>;
  private globalListeners: Set<SearchEventListener>;

  constructor() {
    this.listeners = new Map();
    this.globalListeners = new Set();
  }

  /**
   * Subscribe to a specific event type
   */
  on(eventType: SearchEventType, listener: SearchEventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    this.listeners.get(eventType)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.off(eventType, listener);
    };
  }

  /**
   * Subscribe to all events
   */
  onAny(listener: SearchEventListener): () => void {
    this.globalListeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.offAny(listener);
    };
  }

  /**
   * Unsubscribe from a specific event type
   */
  off(eventType: SearchEventType, listener: SearchEventListener): void {
    const eventListeners = this.listeners.get(eventType);
    if (eventListeners) {
      eventListeners.delete(listener);
    }
  }

  /**
   * Unsubscribe from all events
   */
  offAny(listener: SearchEventListener): void {
    this.globalListeners.delete(listener);
  }

  /**
   * Emit an event to all subscribers
   */
  emit(event: SearchEvent): void {
    // Notify type-specific listeners
    const eventListeners = this.listeners.get(event.type);
    if (eventListeners) {
      for (const listener of eventListeners) {
        try {
          listener(event);
        } catch (error) {
          console.error(`[SearchEventEmitter] Error in listener for ${event.type}:`, error);
        }
      }
    }

    // Notify global listeners
    for (const listener of this.globalListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error(`[SearchEventEmitter] Error in global listener:`, error);
      }
    }
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.listeners.clear();
    this.globalListeners.clear();
  }

  /**
   * Get listener count for a specific event type
   */
  listenerCount(eventType: SearchEventType): number {
    const eventListeners = this.listeners.get(eventType);
    return eventListeners ? eventListeners.size : 0;
  }

  /**
   * Get total listener count (including global listeners)
   */
  totalListenerCount(): number {
    let count = this.globalListeners.size;
    for (const listeners of this.listeners.values()) {
      count += listeners.size;
    }
    return count;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a search event with timestamp
 */
export function createSearchEvent<T extends SearchEvent>(
  type: T['type'],
  data?: T['data']
): T {
  return {
    type,
    timestamp: Date.now(),
    data
  } as T;
}

/**
 * Format event for logging
 */
export function formatEventForLog(event: SearchEvent): string {
  const time = new Date(event.timestamp).toISOString();
  const dataStr = event.data ? JSON.stringify(event.data) : '';
  return `[${time}] ${event.type}: ${dataStr}`;
}
