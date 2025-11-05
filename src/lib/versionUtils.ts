/**
 * Version Utilities
 * 
 * Helper functions for version management and cache clearing
 */

/**
 * Clear the update check cache
 * Useful when version changes or for testing
 */
export function clearUpdateCache(): void {
  try {
    localStorage.removeItem('oc.updateInfo')
    localStorage.removeItem('oc.updateCheckTime')
    console.log('[VersionUtils] Update cache cleared')
  } catch (error) {
    console.error('[VersionUtils] Failed to clear update cache:', error)
  }
}

/**
 * Force a fresh update check by clearing cache
 * Returns true if cache was cleared successfully
 */
export function forceUpdateCheck(): boolean {
  try {
    clearUpdateCache()
    return true
  } catch (error) {
    console.error('[VersionUtils] Failed to force update check:', error)
    return false
  }
}

/**
 * Get the stored version from localStorage
 * Used to detect if the app version has changed
 */
export function getStoredVersion(): string | null {
  try {
    return localStorage.getItem('oc.appVersion')
  } catch (error) {
    console.error('[VersionUtils] Failed to get stored version:', error)
    return null
  }
}

/**
 * Store the current app version
 */
export function storeCurrentVersion(version: string): void {
  try {
    localStorage.setItem('oc.appVersion', version)
  } catch (error) {
    console.error('[VersionUtils] Failed to store version:', error)
  }
}

/**
 * Check if the app version has changed since last run
 * If changed, clears the update cache
 */
export function checkVersionChange(currentVersion: string): boolean {
  const storedVersion = getStoredVersion()
  
  if (storedVersion !== currentVersion) {
    console.log('[VersionUtils] Version changed:', {
      from: storedVersion || 'unknown',
      to: currentVersion
    })
    
    // Clear update cache on version change
    clearUpdateCache()
    
    // Store new version
    storeCurrentVersion(currentVersion)
    
    return true
  }
  
  return false
}
