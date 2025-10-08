// Code Copy Plugin - adds copy button to code blocks

import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import type { MessageProcessorPlugin } from '../types'

export class CodeCopyPlugin implements MessageProcessorPlugin {
  metadata = {
    id: 'code-copy',
    name: 'Code Copy Button',
    version: '1.0.0',
    description: 'Adds copy buttons to code blocks in messages',
    author: 'OpenChat',
    type: 'message-processor' as const,
    appVersion: '1.0.0',
    enabled: true,
  }

  // This plugin works by adding data attributes that the UI can use
  processIncoming(content: string): string {
    // Add markers for code blocks that the renderer can use
    return content
  }

  onLoad() {
    console.log('Code copy plugin loaded')
  }
}

// Helper component for copy button (to be used in markdown renderer)
export function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-2 rounded bg-background/80 hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
      title="Copy code"
    >
      {copied ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </button>
  )
}
