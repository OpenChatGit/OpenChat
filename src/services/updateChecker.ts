/**
 * Update Checker Service
 * 
 * Checks GitHub releases for new versions and provides update notifications.
 */

const GITHUB_REPO = 'OpenChatGit/OpenChat'
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`
const CURRENT_VERSION = '0.4.8'

export interface UpdateInfo {
  available: boolean
  latestVersion: string
  currentVersion: string
  downloadUrl: string
  releaseUrl: string
  releaseNotes: string
}

/**
 * Compare two semantic version strings
 * Returns true if newVersion is greater than currentVersion
 */
function isNewerVersion(currentVersion: string, newVersion: string): boolean {
  // Remove 'v' prefix if present
  const current = currentVersion.replace(/^v/, '').split('.').map(Number)
  const latest = newVersion.replace(/^v/, '').split('.').map(Number)
  
  for (let i = 0; i < 3; i++) {
    const currentPart = current[i] || 0
    const latestPart = latest[i] || 0
    
    if (latestPart > currentPart) return true
    if (latestPart < currentPart) return false
  }
  
  return false
}

/**
 * Check for updates from GitHub releases
 */
export async function checkForUpdates(): Promise<UpdateInfo> {
  try {
    const response = await fetch(GITHUB_API_URL, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    })

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`)
    }

    const release = await response.json()
    const latestVersion = release.tag_name.replace(/^v/, '')
    const available = isNewerVersion(CURRENT_VERSION, latestVersion)

    // Find Windows installer asset
    const windowsAsset = release.assets?.find((asset: any) => 
      asset.name.endsWith('.msi') || asset.name.endsWith('.exe')
    )

    return {
      available,
      latestVersion,
      currentVersion: CURRENT_VERSION,
      downloadUrl: windowsAsset?.browser_download_url || release.html_url,
      releaseUrl: release.html_url,
      releaseNotes: release.body || 'No release notes available',
    }
  } catch (error) {
    console.error('Failed to check for updates:', error)
    return {
      available: false,
      latestVersion: CURRENT_VERSION,
      currentVersion: CURRENT_VERSION,
      downloadUrl: `https://github.com/${GITHUB_REPO}/releases`,
      releaseUrl: `https://github.com/${GITHUB_REPO}/releases`,
      releaseNotes: '',
    }
  }
}

/**
 * Get cached update info from localStorage
 */
export function getCachedUpdateInfo(): UpdateInfo | null {
  try {
    const cached = localStorage.getItem('oc.updateInfo')
    if (!cached) return null

    const info = JSON.parse(cached)
    const cacheTime = localStorage.getItem('oc.updateCheckTime')
    
    if (!cacheTime) return null

    // Cache is valid for 6 hours
    const sixHours = 6 * 60 * 60 * 1000
    const age = Date.now() - parseInt(cacheTime, 10)
    
    if (age > sixHours) return null

    return info
  } catch (error) {
    console.error('Failed to get cached update info:', error)
    return null
  }
}

/**
 * Cache update info in localStorage
 */
export function cacheUpdateInfo(info: UpdateInfo): void {
  try {
    localStorage.setItem('oc.updateInfo', JSON.stringify(info))
    localStorage.setItem('oc.updateCheckTime', Date.now().toString())
  } catch (error) {
    console.error('Failed to cache update info:', error)
  }
}

/**
 * Open the download URL in the default browser
 */
export async function openDownloadPage(url: string): Promise<void> {
  try {
    // Check if we're in Tauri
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      const { openUrl } = await import('@tauri-apps/plugin-opener')
      await openUrl(url)
    } else {
      // Fallback for browser
      window.open(url, '_blank')
    }
  } catch (error) {
    console.error('Failed to open download page:', error)
    // Fallback
    window.open(url, '_blank')
  }
}
