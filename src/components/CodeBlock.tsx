import React, { useState, useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faCopy } from '@fortawesome/free-solid-svg-icons'
import { getOrCreateHighlighter, loadLanguage } from '../lib/shikiHighlighter'
import { normalizeLanguage, getLanguageDisplayName } from '../lib/codeBlockConfig'

interface CodeBlockProps {
  code: string
  language?: string
  filename?: string
  highlightLines?: number[]
  showLineNumbers?: boolean
}

// Maximum code length to highlight (50,000 characters as per requirements)
const MAX_CODE_LENGTH = 50000

// Timeout for async highlighting operations (5 seconds as per requirements)
const HIGHLIGHT_TIMEOUT = 5000

// Debounce delay for streaming content (150ms as per requirements)
const DEBOUNCE_DELAY = 150

const CodeBlockComponent = ({ 
  code, 
  language = 'text',
  filename,
  highlightLines: _highlightLines = [],
  showLineNumbers: _showLineNumbers = false 
}: CodeBlockProps) => {
  const [isCopied, setIsCopied] = useState(false)
  const [highlightedCode, setHighlightedCode] = useState('')
  const [isHighlighting, setIsHighlighting] = useState(false)
  const [highlightError, setHighlightError] = useState(false)
  const lastCodeRef = useRef<string>('')
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Only re-highlight if code actually changed
    if (lastCodeRef.current === code) {
      return
    }
    
    lastCodeRef.current = code
    
    // Clear previous timer and abort ongoing highlighting
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current)
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Skip highlighting for very large code blocks (performance safeguard)
    if (code.length > MAX_CODE_LENGTH) {
      console.warn(`Code block too large (${code.length} chars), skipping highlighting`)
      setHighlightedCode('')
      setHighlightError(false)
      setIsHighlighting(false)
      return
    }
    
    // Debounce highlighting to prevent flickering during streaming
    setIsHighlighting(true)
    setHighlightError(false)
    
    highlightTimerRef.current = setTimeout(() => {
      const abortController = new AbortController()
      abortControllerRef.current = abortController
      
      const highlightAsync = async () => {
        try {
          const normalizedLang = normalizeLanguage(language)
          
          // Load language if needed
          await loadLanguage(normalizedLang)
          
          // Get highlighter instance
          const highlighter = await getOrCreateHighlighter()
          
          // Check if aborted
          if (abortController.signal.aborted) {
            return
          }
          
          // Highlight code with timeout
          const highlightPromise = Promise.resolve(
            highlighter.codeToHtml(code, {
              lang: normalizedLang,
              theme: 'github-dark',
            })
          )
          
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Highlighting timeout')), HIGHLIGHT_TIMEOUT)
          })
          
          const html = await Promise.race([highlightPromise, timeoutPromise])
          
          // Check if aborted before setting state
          if (!abortController.signal.aborted) {
            setHighlightedCode(html)
            setHighlightError(false)
          }
        } catch (error) {
          // Graceful degradation on error
          if (!abortController.signal.aborted) {
            console.warn('Syntax highlighting failed, falling back to plain text:', error)
            setHighlightedCode('')
            setHighlightError(true)
          }
        } finally {
          if (!abortController.signal.aborted) {
            setIsHighlighting(false)
          }
        }
      }
      
      highlightAsync()
    }, DEBOUNCE_DELAY)

    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [code, language])

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  // Get display name for language badge
  const displayLanguage = getLanguageDisplayName(language)
  
  // Determine if we should show plain text or highlighted code
  const shouldShowPlainText = isHighlighting || highlightError || !highlightedCode || code.length > MAX_CODE_LENGTH
  
  return (
    <div className="my-4 rounded-lg overflow-hidden border" style={{ 
      backgroundColor: '#1e1e1e',
      borderColor: '#404040'
    }}>
      {/* Enhanced Header Bar with Language Badge */}
      <div 
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ 
          backgroundColor: '#2d2d2d',
          borderBottomColor: '#404040'
        }}
      >
        {/* Language Badge - Left */}
        <div className="flex items-center gap-2">
          <span 
            className="text-xs font-semibold px-2 py-1 rounded"
            style={{ 
              color: '#d4d4d4',
              backgroundColor: 'rgba(88, 166, 255, 0.15)',
              border: '1px solid rgba(88, 166, 255, 0.3)'
            }}
          >
            {displayLanguage}
          </span>
          {filename && (
            <span 
              className="text-xs font-medium"
              style={{ color: '#858585' }}
            >
              {filename}
            </span>
          )}
        </div>

        {/* Copy Button - Right with Enhanced Hover States */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-1 rounded text-sm transition-all duration-200"
          style={{ 
            color: isCopied ? '#4ade80' : '#d4d4d4',
            backgroundColor: 'transparent'
          }}
          onMouseEnter={(e) => {
            if (!isCopied) {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
          title={isCopied ? 'Copied!' : 'Copy code'}
        >
          <FontAwesomeIcon 
            icon={isCopied ? faCheck : faCopy} 
            className="w-3 h-3"
          />
          <span>{isCopied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>

      {/* Code Content */}
      <pre className="p-4 overflow-x-auto" style={{ margin: 0 }}>
        {shouldShowPlainText ? (
          // Show plain text while highlighting to prevent flickering
          <code 
            className={`language-${language}`}
            style={{ 
              color: '#d4d4d4',
              fontSize: '14px',
              lineHeight: '1.6',
              fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace"
            }}
          >
            {code}
          </code>
        ) : (
          // Show Shiki-highlighted code
          <div 
            className="shiki-wrapper"
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
            style={{
              fontSize: '14px',
              lineHeight: '1.6',
            }}
          />
        )}
      </pre>
    </div>
  )
}

// Memoize to prevent re-renders when other messages update
export const CodeBlock = React.memo(CodeBlockComponent, (prevProps, nextProps) => {
  // Only re-render if code or language changed
  return prevProps.code === nextProps.code && prevProps.language === nextProps.language
})
