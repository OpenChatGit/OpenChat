import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import { Button } from './ui/Button'

export function Settings() {
  const { theme, effectiveTheme, setTheme } = useTheme()

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
                Choose your preferred color scheme
                {theme === 'system' && ` (currently ${effectiveTheme})`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={theme === 'system' ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setTheme('system')}
                className="flex items-center gap-2"
              >
                <Monitor className="w-4 h-4" />
                System
              </Button>
              <Button
                variant={theme === 'light' ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setTheme('light')}
                className="flex items-center gap-2"
              >
                <Sun className="w-4 h-4" />
                Light
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setTheme('dark')}
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
        <div className="p-4 border border-border rounded-lg">
          <p className="text-sm text-muted-foreground">
            Additional app settings coming soon...
          </p>
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
