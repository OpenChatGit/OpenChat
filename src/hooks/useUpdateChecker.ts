/**
 * Hook for checking application updates
 */

import { useState, useEffect } from 'react'
import { checkForUpdates, getCachedUpdateInfo, cacheUpdateInfo, type UpdateInfo } from '../services/updateChecker'

export function useUpdateChecker() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    // Check cache first
    const cached = getCachedUpdateInfo()
    if (cached) {
      setUpdateInfo(cached)
      return
    }

    // Perform update check
    const performCheck = async () => {
      setIsChecking(true)
      try {
        const info = await checkForUpdates()
        setUpdateInfo(info)
        cacheUpdateInfo(info)
      } catch (error) {
        console.error('Update check failed:', error)
      } finally {
        setIsChecking(false)
      }
    }

    // Check on mount
    performCheck()

    // Check every 6 hours
    const interval = setInterval(performCheck, 6 * 60 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  const recheckNow = async () => {
    setIsChecking(true)
    try {
      const info = await checkForUpdates()
      setUpdateInfo(info)
      cacheUpdateInfo(info)
    } catch (error) {
      console.error('Update check failed:', error)
    } finally {
      setIsChecking(false)
    }
  }

  return {
    updateInfo,
    isChecking,
    recheckNow,
  }
}
