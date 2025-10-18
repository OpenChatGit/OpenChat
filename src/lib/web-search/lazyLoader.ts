/**
 * LazyLoader - Provides lazy-loading for heavy web search components
 * 
 * This module implements dynamic imports to load RAGProcessor and ContextFormatter
 * only when they are actually needed, reducing initial bundle size and memory usage.
 */

import type { RAGProcessor } from './ragProcessor';
import type { ContextFormatter } from './contextFormatter';
import type { RAGConfig } from './types';

// ============================================================================
// Lazy Loading State
// ============================================================================

let ragProcessorInstance: RAGProcessor | null = null;
let contextFormatterInstance: ContextFormatter | null = null;

let ragProcessorPromise: Promise<RAGProcessor> | null = null;
let contextFormatterPromise: Promise<ContextFormatter> | null = null;

// ============================================================================
// Lazy Loading Functions
// ============================================================================

/**
 * Lazy-load RAGProcessor
 * Returns cached instance if already loaded, otherwise loads dynamically
 */
export async function loadRAGProcessor(config?: Partial<RAGConfig>): Promise<RAGProcessor> {
  // Return cached instance if available
  if (ragProcessorInstance) {
    if (config) {
      ragProcessorInstance.configure(config);
    }
    return ragProcessorInstance;
  }

  // Return existing promise if already loading
  if (ragProcessorPromise) {
    return ragProcessorPromise;
  }

  // Start loading
  console.log('[LazyLoader] Loading RAGProcessor...');
  
  ragProcessorPromise = import('./ragProcessor')
    .then(module => {
      console.log('[LazyLoader] RAGProcessor loaded');
      ragProcessorInstance = new module.RAGProcessor(config);
      ragProcessorPromise = null; // Clear promise after loading
      return ragProcessorInstance;
    })
    .catch(error => {
      console.error('[LazyLoader] Failed to load RAGProcessor:', error);
      ragProcessorPromise = null; // Clear promise on error
      throw error;
    });

  return ragProcessorPromise;
}

/**
 * Lazy-load ContextFormatter
 * Returns cached instance if already loaded, otherwise loads dynamically
 */
export async function loadContextFormatter(): Promise<ContextFormatter> {
  // Return cached instance if available
  if (contextFormatterInstance) {
    return contextFormatterInstance;
  }

  // Return existing promise if already loading
  if (contextFormatterPromise) {
    return contextFormatterPromise;
  }

  // Start loading
  console.log('[LazyLoader] Loading ContextFormatter...');
  
  contextFormatterPromise = import('./contextFormatter')
    .then(module => {
      console.log('[LazyLoader] ContextFormatter loaded');
      contextFormatterInstance = new module.ContextFormatter();
      contextFormatterPromise = null; // Clear promise after loading
      return contextFormatterInstance;
    })
    .catch(error => {
      console.error('[LazyLoader] Failed to load ContextFormatter:', error);
      contextFormatterPromise = null; // Clear promise on error
      throw error;
    });

  return contextFormatterPromise;
}

/**
 * Check if RAGProcessor is already loaded
 */
export function isRAGProcessorLoaded(): boolean {
  return ragProcessorInstance !== null;
}

/**
 * Check if ContextFormatter is already loaded
 */
export function isContextFormatterLoaded(): boolean {
  return contextFormatterInstance !== null;
}

/**
 * Get cached RAGProcessor instance (if loaded)
 * Returns null if not yet loaded
 */
export function getRAGProcessorIfLoaded(): RAGProcessor | null {
  return ragProcessorInstance;
}

/**
 * Get cached ContextFormatter instance (if loaded)
 * Returns null if not yet loaded
 */
export function getContextFormatterIfLoaded(): ContextFormatter | null {
  return contextFormatterInstance;
}

/**
 * Preload both components in parallel
 * Useful for warming up the cache before they're needed
 */
export async function preloadComponents(ragConfig?: Partial<RAGConfig>): Promise<void> {
  console.log('[LazyLoader] Preloading components...');
  
  await Promise.all([
    loadRAGProcessor(ragConfig),
    loadContextFormatter()
  ]);
  
  console.log('[LazyLoader] All components preloaded');
}

/**
 * Clear cached instances (for testing or memory cleanup)
 */
export function clearCache(): void {
  console.log('[LazyLoader] Clearing cached instances');
  ragProcessorInstance = null;
  contextFormatterInstance = null;
  ragProcessorPromise = null;
  contextFormatterPromise = null;
}

/**
 * Get loading status for all components
 */
export function getLoadingStatus(): {
  ragProcessor: 'not_loaded' | 'loading' | 'loaded';
  contextFormatter: 'not_loaded' | 'loading' | 'loaded';
} {
  return {
    ragProcessor: ragProcessorInstance 
      ? 'loaded' 
      : ragProcessorPromise 
        ? 'loading' 
        : 'not_loaded',
    contextFormatter: contextFormatterInstance 
      ? 'loaded' 
      : contextFormatterPromise 
        ? 'loading' 
        : 'not_loaded'
  };
}
