/**
 * Timestamp Display Component
 * Shows timestamp under user messages
 */

import type { Message } from '../../../../types'

interface TimestampDisplayProps {
  message: Message
}

export function TimestampDisplay({ message }: TimestampDisplayProps) {
  const timestamp = new Date(message.timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return (
    <div className="text-xs text-gray-500 px-2">
      {timestamp}
    </div>
  )
}
