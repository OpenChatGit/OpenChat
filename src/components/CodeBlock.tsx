import React, { useState, useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faCopy } from '@fortawesome/free-solid-svg-icons'
import Prism from 'prismjs'
import 'prismjs/themes/prism-tomorrow.css'
// Import common languages
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-c'
import 'prismjs/components/prism-cpp'
import 'prismjs/components/prism-csharp'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-css'

interface CodeBlockProps {
  code: string
  language?: string
}

const CodeBlockComponent = ({ code, language = 'text' }: CodeBlockProps) => {
  const [isCopied, setIsCopied] = useState(false)
  const [highlightedCode, setHighlightedCode] = useState('')
  const [isHighlighting, setIsHighlighting] = useState(false)
  const lastCodeRef = useRef<string>('')
  const highlightTimerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    // Only re-highlight if code actually changed
    if (lastCodeRef.current === code) {
      return
    }
    
    lastCodeRef.current = code
    
    // Clear previous timer
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current)
    }
    
    // Debounce highlighting to prevent flickering during streaming
    setIsHighlighting(true)
    highlightTimerRef.current = setTimeout(() => {
      try {
        const grammar = Prism.languages[language]
        if (grammar) {
          const highlighted = Prism.highlight(code, grammar, language)
          setHighlightedCode(highlighted)
        } else {
          setHighlightedCode(code)
        }
      } catch (error) {
        setHighlightedCode(code)
      }
      setIsHighlighting(false)
    }, 100) // Wait 100ms before highlighting

    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current)
      }
    }
  }, [code, language])

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  return (
    <div className="my-4 rounded-lg overflow-hidden border" style={{ 
      backgroundColor: '#1e1e1e',
      borderColor: '#404040'
    }}>
      {/* Header Bar */}
      <div 
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ 
          backgroundColor: '#2d2d2d',
          borderBottomColor: '#404040'
        }}
      >
        {/* Language - Left */}
        <span 
          className="text-xs font-medium"
          style={{ 
            color: '#858585'
          }}
        >
          {language}
        </span>

        {/* Copy Button - Right */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-1 rounded text-sm hover:bg-white/10 transition-colors"
          style={{ color: '#d4d4d4' }}
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
        {isHighlighting && !highlightedCode ? (
          // Show plain text while highlighting to prevent flickering
          <code 
            className={`language-${language}`}
            style={{ 
              color: '#d4d4d4',
              fontSize: '14px',
              lineHeight: '1.6',
              fontFamily: 'monospace'
            }}
          >
            {code}
          </code>
        ) : (
          <code 
            className={`language-${language}`}
            style={{ 
              color: '#d4d4d4',
              fontSize: '14px',
              lineHeight: '1.6',
              fontFamily: 'monospace'
            }}
            dangerouslySetInnerHTML={{ __html: highlightedCode || code }}
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
