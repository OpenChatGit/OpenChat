import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'

interface ReasoningBlockProps {
  content: string
  isComplete?: boolean
}

export function ReasoningBlock({ content, isComplete = false }: ReasoningBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="mb-4">
      {/* Thinking Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
      >
        <span>{isComplete ? 'Finished Reasoning' : 'Reasoning...'}</span>
        <FontAwesomeIcon 
          icon={isExpanded ? faChevronUp : faChevronDown} 
          className="w-3 h-3"
        />
      </button>

      {/* Reasoning Content */}
      {isExpanded && (
        <div 
          className="mt-2 text-sm whitespace-pre-wrap break-words rounded-lg p-3"
          style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            color: '#9CA3AF' // Light gray
          }}
        >
          {content}
        </div>
      )}
    </div>
  )
}
