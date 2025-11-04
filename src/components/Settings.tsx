import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import { Button } from './ui/Button'
import { useState } from 'react'
import { DEFAULT_SYSTEM_PROMPT } from '../hooks/useChatWithTools'

export function Settings() {
  const { theme, toggleTheme } = useTheme()
  const [systemPrompt, setSystemPrompt] = useState(
    localStorage.getItem('systemPrompt') || ''
  )

  const [showCustomInstructions, setShowCustomInstructions] = useState(false)


  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSystemPrompt(e.target.value)
    localStorage.setItem('systemPrompt', e.target.value)
  }

  return (
    <div className="space-y-6">
      {/* App Settings Header */}
      <div className="p-4 border border-border rounded-lg bg-muted/30">
        <h3 className="text-lg font-semibold mb-2">Application Settings</h3>
        <p className="text-sm text-muted-foreground">
          General settings for OpenChat
        </p>
      </div>

      {/* Theme Settings */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Appearance</h3>
        <div className="p-4 border border-border rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium mb-1">Theme</p>
              <p className="text-sm text-muted-foreground">
                Choose between light and dark mode
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={theme === 'light' ? 'default' : 'secondary'}
                size="sm"
                onClick={() => theme === 'dark' && toggleTheme()}
                className="flex items-center gap-2"
              >
                <Sun className="w-4 h-4" />
                Light
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'secondary'}
                size="sm"
                onClick={() => theme === 'light' && toggleTheme()}
                className="flex items-center gap-2"
              >
                <Moon className="w-4 h-4" />
                Dark
              </Button>
            </div>
          </div>
        </div>
      </div>

    {/* General Settings */}
<div>
  <h3 className="text-lg font-semibold mb-3">General</h3>
  <div className="p-4 border border-border rounded-lg space-y-4">

    <div>
      <Button
        variant="ghost"
        onClick={() => setShowCustomInstructions(!showCustomInstructions)}
        className="text-sm"
      >
        {showCustomInstructions ? 'Hide' : 'Show'} Custom Instructions
      </Button>
    </div>

    {showCustomInstructions && (
      <div className="mt-4 space-y-2">
        <p className="font-medium">System Prompt</p>
        <p className="text-sm text-muted-foreground">
          Customize the default system behavior for the assistant.
        </p>

        <textarea
          value={systemPrompt}
          onChange={handlePromptChange}
          placeholder="Enter your custom system prompt here..."
          className="w-full p-2 border border-border rounded-md bg-background text-foreground text-sm"
          rows={4}
        />

        <Button
  variant="secondary"
  size="sm"
  onClick={() => {
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT)
    localStorage.setItem('systemPrompt', DEFAULT_SYSTEM_PROMPT)
  }}
>
  Restore Default Prompt
</Button>
      </div>
    )}
  </div>
</div>



      {/* Info Box */}
      <div className="p-4 border border-primary/30 rounded-lg bg-primary/5">
        <h4 className="text-sm font-semibold mb-2">Provider & Model Settings</h4>
        <p className="text-sm text-muted-foreground">
          To configure providers (Ollama, OpenAI, Anthropic) and select models, 
          use the <span className="font-medium text-foreground">"Providers"</span> section in the sidebar.
        </p>
      </div>
    </div>
  )
}
