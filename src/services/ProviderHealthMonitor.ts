/**
 * ProviderHealthMonitor Service
 * 
 * Centralized service for managing provider health checks with background monitoring and caching.
 * Implements singleton pattern to ensure single source of truth for health status across the application.
 * 
 * @example
 * // Get the singleton instance
 * const monitor = ProviderHealthMonitor.getInstance();
 * 
 * // Start monitoring providers
 * monitor.start(providers);
 * 
 * // Subscribe to status updates
 * const unsubscribe = monitor.subscribe((statuses) => {
 *   console.log('Provider statuses updated:', statuses);
 * });
 * 
 * // Get status for a specific provider
 * const ollamaStatus = monitor.getStatus('ollama');
 * 
 * // Force immediate check
 * await monitor.checkProviders(providers, { forceRefresh: true });
 * 
 * // Cleanup when done
 * unsubscribe();
 * monitor.stop();
 */

import type { ProviderConfig } from '../types'
import { ProviderFactory } from '../providers/factory'

/**
 * Health status information for a provider.
 * 
 * @interface ProviderHealthStatus
 * @property {string} type - Provider type identifier (e.g., 'ollama', 'lmstudio', 'anthropic')
 * @property {boolean | undefined} status - Health status: true=healthy, false=unhealthy, undefined=unknown
 * @property {number} timestamp - Unix timestamp (milliseconds) of last health check
 * @property {boolean} checking - Whether a health check is currently in progress for this provider
 */
export interface ProviderHealthStatus {
  type: string
  status: boolean | undefined
  timestamp: number
  checking: boolean
}

/**
 * Configuration options for health check operations.
 * 
 * @interface HealthCheckOptions
 * @property {number} [timeout] - Connection timeout in milliseconds (default: 2000ms)
 * @property {boolean} [forceRefresh] - Force refresh even if cached status is still valid (default: false)
 */
export interface HealthCheckOptions {
  timeout?: number
  forceRefresh?: boolean
}

/**
 * ProviderHealthMonitor - Singleton service for provider health monitoring.
 * 
 * This service provides:
 * - Background monitoring of provider health with 30-second intervals
 * - Persistent caching of health status in localStorage (60-second TTL)
 * - Event-based notifications when provider status changes
 * - Parallel health checks for fast status updates
 * - Aggressive 2-second timeouts for quick failure detection
 * 
 * **Singleton Pattern:**
 * Only one instance exists per application. Use `getInstance()` to access it.
 * 
 * **Event Subscription Lifecycle:**
 * 1. Subscribe using `subscribe(callback)` - returns unsubscribe function
 * 2. Callback receives Map of all provider statuses when any status changes
 * 3. Call unsubscribe function to stop receiving updates
 * 4. Always unsubscribe in component cleanup to prevent memory leaks
 * 
 * @class ProviderHealthMonitor
 */
export class ProviderHealthMonitor {
  private static instance: ProviderHealthMonitor | null = null

  // Status cache
  private statusCache: Map<string, ProviderHealthStatus> = new Map()

  // Event listeners
  private listeners: Set<(statuses: Map<string, ProviderHealthStatus>) => void> = new Set()

  // Background monitoring
  private monitorInterval: number | null = null
  private isMonitoring: boolean = false

  // Configuration constants
  private readonly CACHE_TTL = 60_000      // 60 seconds
  private readonly CHECK_INTERVAL = 30_000  // 30 seconds
  private readonly DEFAULT_TIMEOUT = 2_000  // 2 seconds

  /**
   * Private constructor to enforce singleton pattern.
   * Use `getInstance()` to access the monitor instance.
   * 
   * @private
   */
  private constructor() {
    // Initialize empty cache
    this.statusCache = new Map()
    this.listeners = new Set()
  }

  /**
   * Get the singleton instance of ProviderHealthMonitor.
   * Creates the instance on first call, returns existing instance on subsequent calls.
   * 
   * @static
   * @returns {ProviderHealthMonitor} The singleton instance
   * 
   * @example
   * const monitor = ProviderHealthMonitor.getInstance();
   */
  public static getInstance(): ProviderHealthMonitor {
    if (!ProviderHealthMonitor.instance) {
      ProviderHealthMonitor.instance = new ProviderHealthMonitor()
    }
    return ProviderHealthMonitor.instance
  }

  /**
   * Subscribe to provider health status updates.
   * 
   * The callback will be invoked whenever any provider's health status changes,
   * receiving a Map of all current provider statuses. The callback receives a
   * copy of the status map to prevent external modifications.
   * 
   * **Important:** Always call the returned unsubscribe function in component
   * cleanup (e.g., useEffect cleanup) to prevent memory leaks.
   * 
   * @param {Function} callback - Function to call when statuses change
   * @returns {Function} Unsubscribe function to stop receiving updates
   * 
   * @example
   * // In a React component
   * useEffect(() => {
   *   const unsubscribe = monitor.subscribe((statuses) => {
   *     setConnectionStatus(new Map(statuses));
   *   });
   *   
   *   return unsubscribe; // Cleanup on unmount
   * }, []);
   */
  public subscribe(callback: (statuses: Map<string, ProviderHealthStatus>) => void): () => void {
    this.listeners.add(callback)
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback)
    }
  }

  /**
   * Get the current health status for a specific provider.
   * 
   * Returns cached status if available. Status may be stale if cache TTL has expired.
   * Use `isCacheValid()` to check if the status is still fresh.
   * 
   * @param {string} providerType - Provider type identifier (e.g., 'ollama', 'lmstudio')
   * @returns {ProviderHealthStatus | undefined} Provider health status or undefined if not found
   * 
   * @example
   * const ollamaStatus = monitor.getStatus('ollama');
   * if (ollamaStatus && monitor.isCacheValid(ollamaStatus)) {
   *   console.log('Ollama is', ollamaStatus.status ? 'healthy' : 'unhealthy');
   * }
   */
  public getStatus(providerType: string): ProviderHealthStatus | undefined {
    return this.statusCache.get(providerType)
  }

  /**
   * Get all provider health statuses.
   * 
   * Returns a copy of the internal status cache to prevent external modifications.
   * 
   * @returns {Map<string, ProviderHealthStatus>} Map of all provider health statuses
   * 
   * @example
   * const allStatuses = monitor.getAllStatuses();
   * allStatuses.forEach((status, providerType) => {
   *   console.log(`${providerType}: ${status.status}`);
   * });
   */
  public getAllStatuses(): Map<string, ProviderHealthStatus> {
    return new Map(this.statusCache)
  }

  /**
   * Notify all listeners of status changes
   */
  private notifyListeners(): void {
    const statusCopy = new Map(this.statusCache)
    this.listeners.forEach(listener => {
      try {
        listener(statusCopy)
      } catch (error) {
        console.error('Error in health monitor listener:', error)
      }
    })
  }

  /**
   * Initialize and start background monitoring for the specified providers.
   * 
   * This method:
   * 1. Loads cached status from localStorage
   * 2. Initializes status for any providers not in cache
   * 3. Starts background monitoring with 30-second intervals
   * 4. Performs an immediate health check
   * 
   * Safe to call multiple times - will warn and return if already running.
   * 
   * @param {ProviderConfig[]} providers - List of provider configurations to monitor
   * 
   * @example
   * // In App.tsx or main entry point
   * useEffect(() => {
   *   const monitor = ProviderHealthMonitor.getInstance();
   *   monitor.start(providers);
   *   
   *   return () => monitor.stop(); // Cleanup on unmount
   * }, [providers]);
   */
  public start(providers: ProviderConfig[]): void {
    if (this.isMonitoring) {
      console.warn('ProviderHealthMonitor is already running')
      return
    }

    // Load cached status from localStorage
    this.loadCache()

    // Initialize status for any providers not in cache
    providers.forEach(provider => {
      if (!this.statusCache.has(provider.type)) {
        this.statusCache.set(provider.type, {
          type: provider.type,
          status: undefined,
          timestamp: 0,
          checking: false
        })
      }
    })

    // Start background monitoring
    this.startBackgroundMonitoring(providers)
    this.isMonitoring = true

    console.log('ProviderHealthMonitor started')
  }

  /**
   * Stop background monitoring and cleanup resources.
   * 
   * Clears the monitoring interval and sets monitoring flag to false.
   * Does not clear the status cache, so cached data remains available.
   * 
   * @example
   * // Cleanup when app unmounts
   * monitor.stop();
   */
  public stop(): void {
    this.stopBackgroundMonitoring()
    this.isMonitoring = false
    console.log('ProviderHealthMonitor stopped')
  }

  /**
   * Start background monitoring with interval
   */
  private startBackgroundMonitoring(providers: ProviderConfig[]): void {
    // Perform initial check
    this.performHealthChecks(providers)

    // Set up interval for periodic checks
    this.monitorInterval = window.setInterval(() => {
      this.performHealthChecks(providers)
    }, this.CHECK_INTERVAL)
  }

  /**
   * Stop background monitoring
   */
  private stopBackgroundMonitoring(): void {
    if (this.monitorInterval !== null) {
      clearInterval(this.monitorInterval)
      this.monitorInterval = null
    }
  }

  /**
   * Perform health checks for all providers in parallel
   * Uses Promise.allSettled to ensure all checks complete independently
   */
  private async performHealthChecks(providers: ProviderConfig[]): Promise<void> {
    // Set checking flag to true for all providers before starting
    providers.forEach(provider => {
      const currentStatus = this.statusCache.get(provider.type)
      if (currentStatus) {
        currentStatus.checking = true
      } else {
        this.statusCache.set(provider.type, {
          type: provider.type,
          status: undefined,
          timestamp: Date.now(),
          checking: true
        })
      }
    })

    // Notify listeners that checking has started
    this.notifyListeners()

    // Execute all provider tests in parallel using Promise.allSettled
    await Promise.allSettled(
      providers.map(async (provider) => {
        try {
          // Create provider instance
          const providerInstance = ProviderFactory.createProvider(provider)
          
          // Test connection with default timeout
          const isHealthy = await providerInstance.testConnection(this.DEFAULT_TIMEOUT)
          
          // Update status cache with result
          this.statusCache.set(provider.type, {
            type: provider.type,
            status: isHealthy,
            timestamp: Date.now(),
            checking: false
          })
        } catch (error) {
          // Isolate failures - one provider failure doesn't affect others
          // Only log if it's an unexpected error (not connection refused/timeout)
          const errorMsg = error instanceof Error ? error.message : String(error)
          const isExpectedFailure = 
            errorMsg.includes('not reachable') ||
            errorMsg.includes('Failed to fetch') ||
            errorMsg.includes('ERR_CONNECTION_REFUSED') ||
            errorMsg.includes('ERR_FAILED') ||
            errorMsg.includes('CORS') ||
            errorMsg.includes('Network request failed')
          
          if (!isExpectedFailure) {
            console.error(`Health check failed for ${provider.type}:`, error)
          }
          
          // Mark provider as unhealthy
          this.statusCache.set(provider.type, {
            type: provider.type,
            status: false,
            timestamp: Date.now(),
            checking: false
          })
        }
      })
    )

    // Save updated cache to localStorage
    this.saveCache()

    // Notify all listeners of status updates
    this.notifyListeners()
  }

  /**
   * Force an immediate health check for specific providers.
   * 
   * By default, only checks providers with stale cache (older than 60 seconds).
   * Use `forceRefresh: true` to check all providers regardless of cache age.
   * 
   * All checks run in parallel for fast completion. Individual provider failures
   * are isolated and don't affect other providers.
   * 
   * @param {ProviderConfig[]} providers - List of provider configurations to check
   * @param {HealthCheckOptions} [options] - Optional configuration
   * @param {number} [options.timeout=2000] - Connection timeout in milliseconds
   * @param {boolean} [options.forceRefresh=false] - Force refresh even if cache is valid
   * @returns {Promise<void>} Resolves when all checks complete
   * 
   * @example
   * // Check providers with stale cache
   * await monitor.checkProviders(providers);
   * 
   * // Force check all providers with custom timeout
   * await monitor.checkProviders(providers, { 
   *   forceRefresh: true, 
   *   timeout: 5000 
   * });
   */
  public async checkProviders(providers: ProviderConfig[], options?: HealthCheckOptions): Promise<void> {
    const forceRefresh = options?.forceRefresh ?? false

    // Filter providers based on forceRefresh option
    const providersToCheck = forceRefresh 
      ? providers 
      : providers.filter(provider => {
          const status = this.statusCache.get(provider.type)
          return !status || !this.isCacheValid(status)
        })

    // If no providers need checking, return early
    if (providersToCheck.length === 0) {
      return
    }

    // Set checking flag to true for providers being checked
    providersToCheck.forEach(provider => {
      const currentStatus = this.statusCache.get(provider.type)
      if (currentStatus) {
        currentStatus.checking = true
      } else {
        this.statusCache.set(provider.type, {
          type: provider.type,
          status: undefined,
          timestamp: Date.now(),
          checking: true
        })
      }
    })

    // Notify listeners that checking has started
    this.notifyListeners()

    // Execute all provider tests in parallel using Promise.allSettled
    await Promise.allSettled(
      providersToCheck.map(async (provider) => {
        try {
          // Create provider instance
          const providerInstance = ProviderFactory.createProvider(provider)
          
          // Test connection with timeout from options or default
          const timeout = options?.timeout ?? this.DEFAULT_TIMEOUT
          const isHealthy = await providerInstance.testConnection(timeout)
          
          // Update status cache with result
          this.statusCache.set(provider.type, {
            type: provider.type,
            status: isHealthy,
            timestamp: Date.now(),
            checking: false
          })
        } catch (error) {
          // Isolate failures - one provider failure doesn't affect others
          // Only log if it's an unexpected error (not connection refused/timeout)
          const errorMsg = error instanceof Error ? error.message : String(error)
          const isExpectedFailure = 
            errorMsg.includes('not reachable') ||
            errorMsg.includes('Failed to fetch') ||
            errorMsg.includes('ERR_CONNECTION_REFUSED') ||
            errorMsg.includes('ERR_FAILED') ||
            errorMsg.includes('CORS') ||
            errorMsg.includes('Network request failed')
          
          if (!isExpectedFailure) {
            console.error(`Health check failed for ${provider.type}:`, error)
          }
          
          // Mark provider as unhealthy
          this.statusCache.set(provider.type, {
            type: provider.type,
            status: false,
            timestamp: Date.now(),
            checking: false
          })
        }
      })
    )

    // Save updated cache to localStorage
    this.saveCache()

    // Notify all listeners of status updates
    this.notifyListeners()
  }

  /**
   * Load cached status from localStorage
   */
  private loadCache(): void {
    try {
      const cached = localStorage.getItem('oc.providerHealth')
      if (!cached) return

      const parsed = JSON.parse(cached)

      // Validate and load cache entries
      for (const [key, value] of Object.entries(parsed)) {
        if (this.isValidCacheEntry(value)) {
          this.statusCache.set(key, value as ProviderHealthStatus)
        }
      }

      console.log('Loaded provider health cache:', this.statusCache.size, 'entries')
    } catch (error) {
      console.warn('Failed to load provider health cache:', error)
      // Clear corrupted cache
      localStorage.removeItem('oc.providerHealth')
    }
  }

  /**
   * Save current status to localStorage
   */
  private saveCache(): void {
    try {
      const cacheObject: Record<string, ProviderHealthStatus> = {}
      
      this.statusCache.forEach((value, key) => {
        cacheObject[key] = value
      })

      localStorage.setItem('oc.providerHealth', JSON.stringify(cacheObject))
    } catch (error) {
      console.error('Failed to save provider health cache:', error)
    }
  }

  /**
   * Check if a cached status entry is still valid (not expired).
   * 
   * Cache entries are considered valid if they are less than 60 seconds old.
   * 
   * @param {ProviderHealthStatus} status - Provider health status to check
   * @returns {boolean} True if cache is still valid, false if expired
   * 
   * @example
   * const status = monitor.getStatus('ollama');
   * if (status && !monitor.isCacheValid(status)) {
   *   // Cache is stale, trigger a fresh check
   *   await monitor.checkProviders([ollamaProvider]);
   * }
   */
  public isCacheValid(status: ProviderHealthStatus): boolean {
    const age = Date.now() - status.timestamp
    return age < this.CACHE_TTL
  }

  /**
   * Validate cache entry structure
   * @param entry Cache entry to validate
   * @returns True if entry is valid
   */
  private isValidCacheEntry(entry: any): boolean {
    return (
      typeof entry === 'object' &&
      typeof entry.type === 'string' &&
      (typeof entry.status === 'boolean' || entry.status === undefined) &&
      typeof entry.timestamp === 'number' &&
      typeof entry.checking === 'boolean'
    )
  }
}
