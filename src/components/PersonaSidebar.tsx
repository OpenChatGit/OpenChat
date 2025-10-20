import { useEffect } from 'react'
import { X, Sparkles, Code, BookOpen, Lightbulb } from 'lucide-react'
import { Toggle } from './ui/Toggle'

interface PersonaSidebarProps {
  isOpen: boolean
  onClose: () => void
  personaPrompt: string
  personaEnabled: boolean
  onPersonaPromptChange: (prompt: string) => void
  onPersonaEnabledChange: (enabled: boolean) => void
}

export function PersonaSidebar({
  isOpen,
  onClose,
  personaPrompt,
  personaEnabled,
  onPersonaPromptChange,
  onPersonaEnabledChange,
}: PersonaSidebarProps) {
  // Handle Escape key to close sidebar
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  const characterCount = personaPrompt.length

  // Preset personas for quick selection
  const presets = [
    {
      icon: Code,
      label: 'Coding Assistant',
      prompt: 'You are an expert software engineer who provides clear, concise code solutions with best practices. You explain your reasoning and suggest optimizations.'
    },
    {
      icon: BookOpen,
      label: 'Technical Writer',
      prompt: 'You are a technical documentation expert who creates clear, well-structured documentation. You focus on clarity, completeness, and user-friendly explanations.'
    },
    {
      icon: Lightbulb,
      label: 'Creative Partner',
      prompt: 'You are a creative brainstorming partner who helps generate innovative ideas. You think outside the box and encourage exploration of different perspectives.'
    },
    {
      icon: Sparkles,
      label: 'Friendly Tutor',
      prompt: 'You are a patient and encouraging tutor who breaks down complex topics into simple, understandable concepts. You use examples and analogies to aid learning.'
    }
  ]

  const handlePresetClick = (preset: typeof presets[0]) => {
    onPersonaPromptChange(preset.prompt)
    if (!personaEnabled) {
      onPersonaEnabledChange(true)
    }
  }

  const handleClearPrompt = () => {
    onPersonaPromptChange('')
  }

  return (
    <>
      {/* Backdrop overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full z-40 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } w-full md:w-80`}
        style={{ backgroundColor: 'var(--color-sidebar)' }}
      >
        <div className="flex flex-col h-full">
          {/* Header with close button */}
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
            <h2 className="text-lg font-semibold">Persona Settings</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Close sidebar"
              title="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Enable/Disable Toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Enable Persona</label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Activate custom AI persona for this chat
                  </p>
                </div>
                <Toggle
                  checked={personaEnabled}
                  onChange={onPersonaEnabledChange}
                />
              </div>

              {/* Visual indicator for active persona */}
              {personaEnabled && personaPrompt.trim() && (
                <div className="flex items-center gap-2 text-xs text-green-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span>Persona active</span>
                </div>
              )}
            </div>

            {/* Quick Presets */}
            {!personaPrompt.trim() && (
              <div className="space-y-2">
                <label className="text-sm font-medium block">Quick Presets</label>
                <div className="grid grid-cols-2 gap-2">
                  {presets.map((preset) => {
                    const Icon = preset.icon
                    return (
                      <button
                        key={preset.label}
                        onClick={() => handlePresetClick(preset)}
                        className="flex flex-col items-center gap-2 p-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-primary/50 transition-all duration-200 group"
                      >
                        <Icon className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                        <span className="text-xs text-center">{preset.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Persona Prompt Text Area */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium block">Persona Prompt</label>
                {personaPrompt.trim() && (
                  <button
                    onClick={handleClearPrompt}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="relative">
                <textarea
                  value={personaPrompt}
                  onChange={(e) => onPersonaPromptChange(e.target.value)}
                  placeholder="Define your AI persona or choose a preset above..."
                  className="w-full min-h-[200px] p-3 rounded-lg border border-white/10 bg-white/5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 resize-y transition-all"
                  style={{ 
                    backgroundColor: 'var(--color-input)',
                    scrollbarWidth: 'thin'
                  }}
                />
              </div>
              
              {/* Character count and status */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{characterCount} characters</span>
                {personaEnabled && !personaPrompt.trim() && (
                  <span className="text-yellow-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"></span>
                    Persona enabled but empty
                  </span>
                )}
              </div>
            </div>

            {/* Tips when persona is defined */}
            {personaPrompt.trim() && (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-xs text-green-300">
                  <strong>Tip:</strong> Be specific about the tone, expertise level, and response style you want. The AI will adapt its behavior accordingly.
                </p>
              </div>
            )}

            {/* Info box */}
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-xs text-blue-300">
                <strong>Note:</strong> The persona prompt is combined with the global system prompt and applies only to this chat session.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
