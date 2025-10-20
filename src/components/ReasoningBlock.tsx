import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faChevronUp, faCheck } from '@fortawesome/free-solid-svg-icons'
import contentCopyIcon from '../assets/content_copy.svg'

interface ReasoningBlockProps {
  content: string
  isComplete?: boolean
}

export function ReasoningBlock({ content, isComplete = false }: ReasoningBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  return (
    <div className="mb-2">
      {/* Header row: toggle on the left, copy button on the right when expanded */}
      <div className="flex items-center justify-between">
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

        {isExpanded && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(content)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
            className="rounded hover:bg-white/10 transition-colors flex items-center justify-center leading-none"
            title={copied ? 'Copied!' : 'Copy reasoning'}
            aria-label={copied ? 'Copied' : 'Copy reasoning'}
            style={{ width: '28px', height: '28px' }}
          >
            {copied ? (
              <FontAwesomeIcon icon={faCheck} className="w-4 h-4" />
            ) : (
              <img src={contentCopyIcon} alt="Copy" className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Reasoning Content */}
      {isExpanded && (
        <div 
          className="mt-2 text-sm whitespace-pre-wrap break-words rounded-lg p-3 overflow-y-auto"
          style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            color: '#9CA3AF',
            maxHeight: '300px'
          }}
        >
          {content}
        </div>
      )}
    </div>
  )
}
