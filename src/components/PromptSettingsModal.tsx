import { useEffect, useState } from 'react'
import { X, User, Settings2, RotateCcw, Sparkles, Code, BookOpen, Lightbulb } from 'lucide-react'
import { Toggle } from './ui/Toggle'

interface PromptSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  // Persona props
  personaPrompt: string
  personaEnabled: boolean
  onUpdatePersona: (prompt: string, enabled: boolean) => void
  // Global system prompt props
  globalSystemPrompt: string
  onGlobalSystemPromptChange: (prompt: string) => void
}

type TabType = 'persona' | 'global'

const DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant."

export function PromptSettingsModal({
  isOpen,
  onClose,
  personaPrompt,
  personaEnabled,
  onUpdatePersona,
  globalSystemPrompt,
  onGlobalSystemPromptChange,
}: PromptSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('persona')
  const [localPersonaPrompt, setLocalPersonaPrompt] = useState(personaPrompt)
  const [localPersonaEnabled, setLocalPersonaEnabled] = useState(personaEnabled)
  const [localGlobalPrompt, setLocalGlobalPrompt] = useState(globalSystemPrompt)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setLocalPersonaPrompt(personaPrompt)
      setLocalPersonaEnabled(personaEnabled)
      setLocalGlobalPrompt(globalSystemPrompt)
      setHasChanges(false)
    }
  }, [isOpen, personaPrompt, personaEnabled, globalSystemPrompt])

  useEffect(() => {
    const personaChanged = localPersonaPrompt !== personaPrompt || localPersonaEnabled !== personaEnabled
    const globalChanged = localGlobalPrompt !== globalSystemPrompt
    setHasChanges(personaChanged || globalChanged)
  }, [localPersonaPrompt, localPersonaEnabled, localGlobalPrompt, personaPrompt, personaEnabled, globalSystemPrompt])

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
    // Update persona with both values at once to avoid race conditions
    onUpdatePersona(localPersonaPrompt, localPersonaEnabled)
    onGlobalSystemPromptChange(localGlobalPrompt)
    setHasChanges(false)
    onClose()
  }

  const handleResetGlobal = () => {
    const confirmReset = window.confirm('Reset to default system prompt?')
    if (confirmReset) {
      setLocalGlobalPrompt(DEFAULT_SYSTEM_PROMPT)
    }
  }

  const handleClearPersona = () => {
    setLocalPersonaPrompt('')
  }

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
    setLocalPersonaPrompt(preset.prompt)
    if (!localPersonaEnabled) {
      setLocalPersonaEnabled(true)
    }
  }

  if (!isOpen) return null

  const personaCharCount = localPersonaPrompt.length
  const globalCharCount = localGlobalPrompt.length

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
        className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-3xl max-h-[85vh] shadow-2xl rounded-lg overflow-hidden"
        style={{ backgroundColor: 'var(--color-sidebar)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col h-full max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Prompt Settings</h2>
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

          {/* Tabs */}
          <div className="flex border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
            <button
              onClick={() => setActiveTab('persona')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'persona'
                  ? 'border-b-2 border-primary'
                  : 'hover:bg-white/5'
              }`}
              style={{
                color: activeTab === 'persona' ? 'var(--color-primary)' : 'var(--color-muted-foreground)'
              }}
            >
              <div className="flex items-center justify-center gap-2">
                <User className="w-4 h-4" />
                <span>Session Persona</span>
                {personaEnabled && <span className="w-2 h-2 bg-green-400 rounded-full" />}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('global')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'global'
                  ? 'border-b-2 border-primary'
                  : 'hover:bg-white/5'
              }`}
              style={{
                color: activeTab === 'global' ? 'var(--color-primary)' : 'var(--color-muted-foreground)'
              }}
            >
              <div className="flex items-center justify-center gap-2">
                <Settings2 className="w-4 h-4" />
                <span>Global System Prompt</span>
              </div>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeTab === 'persona' ? (
              <>
                {/* Persona Tab */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <label className="text-sm font-medium">Enable Persona</label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Activate custom AI persona for this chat session
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Toggle
                        checked={localPersonaEnabled}
                        onChange={setLocalPersonaEnabled}
                      />
                    </div>
                  </div>

                  {localPersonaEnabled && localPersonaPrompt.trim() && (
                    <div className="flex items-center gap-2 text-xs text-green-400 animate-in fade-in duration-200">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span>Persona active</span>
                    </div>
                  )}
                  
                  {localPersonaEnabled && !localPersonaPrompt.trim() && (
                    <div className="flex items-center gap-2 text-xs text-yellow-400 animate-in fade-in duration-200">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                      <span>Persona enabled but no prompt set</span>
                    </div>
                  )}
                </div>

                {/* Quick Presets */}
                {!localPersonaPrompt.trim() && (
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
                    {localPersonaPrompt.trim() && (
                      <button
                        onClick={handleClearPersona}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <textarea
                      value={localPersonaPrompt}
                      onChange={(e) => setLocalPersonaPrompt(e.target.value)}
                      placeholder="Define your AI persona or choose a preset above..."
                      className="w-full min-h-[250px] p-3 rounded-lg border border-white/10 bg-white/5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 resize-y transition-all"
                      style={{ 
                        backgroundColor: 'var(--color-input)',
                        scrollbarWidth: 'thin'
                      }}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{personaCharCount} characters</span>
                  </div>
                </div>

                {/* Info box */}
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-xs text-blue-300">
                    <strong>Note:</strong> The persona prompt is combined with the global system prompt and applies only to this chat session.
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* Global System Prompt Tab */}
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-sm text-blue-300">
                    <strong>Global System Prompt:</strong> This prompt is applied to all chat sessions and defines the AI's base behavior. 
                    It can be combined with per-session persona prompts for more specific customization.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium block">System Prompt</label>
                    <button
                      onClick={handleResetGlobal}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      title="Reset to default"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset to Default
                    </button>
                  </div>
                  <div className="relative">
                    <textarea
                      value={localGlobalPrompt}
                      onChange={(e) => setLocalGlobalPrompt(e.target.value)}
                      placeholder="Enter your global system prompt..."
                      className="w-full min-h-[350px] p-3 rounded-lg border border-white/10 bg-white/5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 resize-y transition-all"
                      style={{ 
                        backgroundColor: 'var(--color-input)',
                        scrollbarWidth: 'thin'
                      }}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{globalCharCount} characters</span>
                  </div>
                </div>

                {localGlobalPrompt.trim().length === 0 && (
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <p className="text-xs text-yellow-300">
                      <strong>Warning:</strong> An empty system prompt may result in unpredictable AI behavior. Consider using the default prompt.
                    </p>
                  </div>
                )}
              </>
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
                color: hasChanges ? 'var(--color-background)' : 'var(--color-muted-foreground)'
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
