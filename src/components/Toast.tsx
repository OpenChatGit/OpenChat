import { useEffect } from 'react'
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react'

export type ToastType = 'error' | 'success' | 'info'

interface ToastProps {
  message: string
  type?: ToastType
  duration?: number
  onClose: () => void
}

export function Toast({ message, type = 'error', duration = 5000, onClose }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  const getIcon = () => {
    switch (type) {
      case 'error':
        return <AlertCircle className="w-5 h-5" style={{ color: '#FF6B6B' }} />
      case 'success':
        return <CheckCircle className="w-5 h-5" style={{ color: '#51CF66' }} />
      case 'info':
        return <Info className="w-5 h-5" style={{ color: '#4DABF7' }} />
    }
  }

  const getBackgroundColor = () => {
    switch (type) {
      case 'error':
        return '#3A1F1F'
      case 'success':
        return '#1F3A1F'
      case 'info':
        return '#1F2A3A'
    }
  }

  const getTextColor = () => {
    switch (type) {
      case 'error':
        return '#FF6B6B'
      case 'success':
        return '#51CF66'
      case 'info':
        return '#4DABF7'
    }
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg max-w-md animate-slide-up"
      style={{ backgroundColor: getBackgroundColor() }}
      role="alert"
      aria-live="assertive"
    >
      {getIcon()}
      <p className="flex-1 text-sm" style={{ color: getTextColor() }}>
        {message}
      </p>
      <button
        onClick={onClose}
        className="flex-shrink-0 hover:opacity-70 transition-opacity"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" style={{ color: getTextColor() }} />
      </button>
    </div>
  )
}
