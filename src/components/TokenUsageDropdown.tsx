import { useEffect, useRef } from 'react'

interface TokenUsageDropdownProps {
  tokenUsage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
    tokensPerSecond?: number
    streamDuration?: number
  }
  isOpen: boolean
  onToggle: () => void
}

export function TokenUsageDropdown({ tokenUsage, isOpen, onToggle }: TokenUsageDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Handle Escape key to close dropdown
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onToggle()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onToggle])

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onToggle()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onToggle])

  if (!isOpen) return null

  return (
    <div
      ref={dropdownRef}
      className="mt-2 rounded-lg overflow-hidden transition-all duration-200 ease-in-out"
      style={{ 
        backgroundColor: '#2A2A2C',
        animation: 'slideDown 0.2s ease-out'
      }}
      role="region"
      aria-label="Token usage information"
    >
      <div className="px-4 py-3">
        <div className="text-sm font-medium mb-2" style={{ color: 'var(--color-foreground)' }}>
          Token Usage
        </div>
        
        {tokenUsage ? (
          <div className="space-y-1.5 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
            <div className="flex justify-between items-center">
              <span>Input:</span>
              <span 
                className="font-medium tabular-nums" 
                style={{ color: 'var(--color-foreground)' }}
                aria-label={`${tokenUsage.inputTokens} input tokens`}
              >
                {tokenUsage.inputTokens.toLocaleString()} tokens
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span>Output:</span>
              <span 
                className="font-medium tabular-nums" 
                style={{ color: 'var(--color-foreground)' }}
                aria-label={`${tokenUsage.outputTokens} output tokens`}
              >
                {tokenUsage.outputTokens.toLocaleString()} tokens
              </span>
            </div>
            
            <div 
              className="flex justify-between items-center pt-1.5 mt-1.5"
              style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}
            >
              <span className="font-medium">Total:</span>
              <span 
                className="font-semibold tabular-nums" 
                style={{ color: 'var(--color-foreground)' }}
                aria-label={`${tokenUsage.totalTokens} total tokens`}
              >
                {tokenUsage.totalTokens.toLocaleString()} tokens
              </span>
            </div>
            
            {tokenUsage.tokensPerSecond !== undefined && (
              <div 
                className="flex justify-between items-center pt-1.5 mt-1.5"
                style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}
              >
                <span className="font-medium">Speed:</span>
                <span 
                  className="font-semibold tabular-nums" 
                  style={{ color: 'var(--color-foreground)' }}
                  aria-label={`${tokenUsage.tokensPerSecond} tokens per second`}
                >
                  {tokenUsage.tokensPerSecond.toFixed(2)} tokens/s
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
            Token usage information not available
          </div>
        )}
      </div>
    </div>
  )
}
