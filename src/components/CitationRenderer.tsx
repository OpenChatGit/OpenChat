/**
 * CitationRenderer - React component for rendering clickable citation links
 * 
 * Displays citations as superscript numbers [1], [2], etc. that are clickable
 * and open the source URL in a new tab when clicked.
 * 
 * Features:
 * - Clean superscript format like modern citation systems
 * - Click to open source URL in new tab
 * - Hover tooltip showing source title and domain
 * - Subtle hover effects (background highlight, underline)
 * - Fallback rendering for invalid source IDs
 * - Accessibility support (aria-label, title, keyboard navigation)
 * - Highlight support when source is clicked from "Searched Web" favicons
 */

import { useState, useEffect } from 'react'
import { SourceRegistry, type SourceMetadata } from '../lib/web-search/sourceRegistry'

export interface CitationProps {
  sourceId: number
  sectionId?: number
  sourceRegistry: SourceRegistry
}

/**
 * Citation component - renders a clickable citation link
 * 
 * @param sourceId - The source ID to reference
 * @param sectionId - Optional section ID within the source
 * @param sourceRegistry - Registry containing source metadata
 * 
 * @example
 * <Citation sourceId={1} sourceRegistry={registry} />
 * <Citation sourceId={2} sectionId={3} sourceRegistry={registry} />
 */
export function Citation({ sourceId, sectionId, sourceRegistry }: CitationProps) {
  const [isHighlighted, setIsHighlighted] = useState(false)

  // Listen for highlight events from SearchResultsDisplay
  useEffect(() => {
    const handleHighlight = (event: Event) => {
      const customEvent = event as CustomEvent<{ sourceId: number | null }>
      if (customEvent.detail.sourceId === sourceId) {
        setIsHighlighted(true)
        // Auto-clear highlight after animation
        setTimeout(() => setIsHighlighted(false), 3000)
      } else if (customEvent.detail.sourceId === null) {
        setIsHighlighted(false)
      }
    }

    window.addEventListener('highlightCitation', handleHighlight)
    return () => window.removeEventListener('highlightCitation', handleHighlight)
  }, [sourceId])

  try {
    const source: SourceMetadata | undefined = sourceRegistry?.getSource(sourceId)
    
    // Fallback rendering for invalid source IDs
    if (!source) {
      console.warn(`Citation references unknown source: ${sourceId}`)
      return (
        <sup>
          <span 
            className="citation-invalid"
            style={{
              color: 'var(--color-muted-foreground)',
              fontSize: '0.75rem',
              fontStyle: 'italic'
            }}
          >
            [{sourceId}]
          </span>
        </sup>
      )
    }
    
    // Click handler to open source URL in new tab
    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault()
      try {
        window.open(source.url, '_blank', 'noopener,noreferrer')
      } catch (error) {
        console.error('Failed to open citation URL:', error)
        // Fallback: show alert with URL
        alert(`Unable to open link. URL: ${source.url}`)
      }
    }
    
    // Keyboard handler for accessibility
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleClick(e as any)
      }
    }
    
    // Format tooltip text
    const tooltipText = `${source.title} - ${source.domain}`
    const ariaLabel = `View source ${sourceId}${sectionId ? `, section ${sectionId}` : ''}: ${source.title}`
    
    return (
      <sup>
        <button
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          className={`citation-link ${isHighlighted ? 'citation-highlighted' : ''}`}
          title={tooltipText}
          aria-label={ariaLabel}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0.125rem 0.25rem',
            margin: '0 0.125rem',
            backgroundColor: isHighlighted ? 'rgba(74, 158, 255, 0.3)' : 'transparent',
            border: 'none',
            borderRadius: '0.25rem',
            color: '#4a9eff',
            fontSize: '0.75rem',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontFamily: 'inherit',
            lineHeight: '1',
            verticalAlign: 'baseline',
            whiteSpace: 'nowrap',
            boxShadow: isHighlighted ? '0 0 6px rgba(74, 158, 255, 0.6)' : 'none',
            textDecoration: 'none'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(74, 158, 255, 0.15)'
            e.currentTarget.style.textDecoration = 'underline'
          }}
          onMouseLeave={(e) => {
            if (!isHighlighted) {
              e.currentTarget.style.backgroundColor = 'transparent'
            }
            e.currentTarget.style.textDecoration = 'none'
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = '2px solid rgba(74, 158, 255, 0.5)'
            e.currentTarget.style.outlineOffset = '2px'
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = 'none'
          }}
        >
          [{sourceId}]
        </button>
      </sup>
    )
  } catch (error) {
    // Error boundary - render as plain text if anything goes wrong
    console.error('Error rendering citation:', error)
    return (
      <sup>
        <span style={{ fontSize: '0.75rem' }}>
          [{sourceId}]
        </span>
      </sup>
    )
  }
}
