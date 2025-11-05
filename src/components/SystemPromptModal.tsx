import { useEffect, useState } from 'react'
import { X, Settings2, RotateCcw } from 'lucide-react'

interface SystemPromptModalProps {
  isOpen: boolean
  onClose: () => void
  currentPrompt: string
  onSave: (prompt: string) => void
}

const DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant."

export function SystemPromptModal({
  isOpen,
  onClose,
  currentPrompt,
  onSave,
}: SystemPromptModalProps) {
  const [prompt, setPrompt] = useState(currentPrompt)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    setPrompt(currentPrompt)
    setHasChanges(false)
  }, [currentPrompt, isOpen])

  useEffect(() => {
    setHasChanges(prompt !== currentPrompt)
  }, [prompt, currentPrompt])

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, hasChanges])

  const handleClose = () => {
    if (hasChanges) {
      const confirmClose = window.confirm('You have unsaved changes. Are you sure you want to close?')
      if (!confirmClose) return
    }
    onClose()
  }

  const handleSave = () => {
    onSave(prompt)
    setHasChanges(false)
    onClose()
  }

  const handleReset = () => {
    const confirmReset = window.confirm('Reset to default system prompt?')
    if (confirmReset) {
      setPrompt(DEFAULT_SYSTEM_PROMPT)
    }
  }

  if (!isOpen) return null

  const characterCount = prompt.length

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-50 transition-opacity duration-300"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl max-h-[80vh] shadow-2xl rounded-lg overflow-hidden"
        style={{ backgroundColor: 'var(--color-sidebar)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col h-full max-h-[80vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
            <div className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Global System Prompt</h2>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Close modal"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Info box */}
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-sm text-blue-300">
                <strong>Global System Prompt:</strong> This prompt is applied to all chat sessions and defines the AI's base behavior. 
                It can be combined with per-session persona prompts for more specific customization.
              </p>
            </div>

            {/* Prompt Text Area */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium block">System Prompt</label>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  title="Reset to default"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset to Default
                </button>
              </div>
              <div className="relative">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter your global system prompt..."
                  className="w-full min-h-[300px] p-3 rounded-lg border border-white/10 bg-white/5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 resize-y transition-all"
                  style={{ 
                    backgroundColor: 'var(--color-input)',
                    scrollbarWidth: 'thin'
                  }}
                />
              </div>
              
              {/* Character count */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{characterCount} characters</span>
                {hasChanges && (
                  <span className="text-yellow-400">Unsaved changes</span>
                )}
              </div>
            </div>

            {/* Warning when empty */}
            {prompt.trim().length === 0 && (
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-xs text-yellow-300">
                  <strong>Warning:</strong> An empty system prompt may result in unpredictable AI behavior. Consider using the default prompt.
                </p>
              </div>
            )}
          </div>

          {/* Footer with action buttons */}
          <div className="flex items-center justify-end gap-2 p-4 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className="px-4 py-2 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: hasChanges ? 'var(--color-primary)' : 'var(--color-muted)',
                color: hasChanges ? 'white' : 'var(--color-muted-foreground)'
              }}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
