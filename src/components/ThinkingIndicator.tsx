// Thinking/Status Indicator Component - Same style as "Finished Reasoning"

import { useEffect, useState } from 'react'

interface ThinkingIndicatorProps {
  status: 'thinking' | 'searching' | 'processing' | 'generating' | 'cancelled'
  message?: string
}

export function ThinkingIndicator({ status, message }: ThinkingIndicatorProps) {
  const [dots, setDots] = useState('')

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'))
    }, 500)

    return () => clearInterval(interval)
  }, [])

  const getStatusText = () => {
    switch (status) {
      case 'thinking':
        return 'Thinking'
      case 'searching':
        return 'Searching Web'
      case 'processing':
        return 'Processing'
      case 'generating':
        return 'Generating'
      case 'cancelled':
        return 'Generation cancelled'
    }
  }

  const statusText = message || getStatusText()

  return (
    <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
      <span>{statusText}{dots}</span>
    </div>
  )
}
