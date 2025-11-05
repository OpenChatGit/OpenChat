import { useState, useRef, useEffect } from 'react'
import { Settings, User, LogOut, HelpCircle } from 'lucide-react'
import { cn } from '../lib/utils'

interface ProfileButtonProps {
  onOpenSettings: () => void
}

export function ProfileButton({ onOpenSettings }: ProfileButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropupRef = useRef<HTMLDivElement>(null)

  // Close dropup when clicking outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (dropupRef.current && !dropupRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const menuItems = [
    {
      icon: Settings,
      label: 'Settings',
      onClick: () => {
        onOpenSettings()
        setIsOpen(false)
      }
    },
    {
      icon: HelpCircle,
      label: 'Help & Support',
      onClick: () => {
        // TODO: Open help modal
        setIsOpen(false)
      }
    },
    {
      icon: LogOut,
      label: 'Sign Out',
      onClick: () => {
        // TODO: Implement sign out
        setIsOpen(false)
      },
      danger: true
    }
  ]

  return (
    <div ref={dropupRef} className="relative">
      {/* Dropup Menu */}
      {isOpen && (
        <div
          className="absolute bottom-full left-0 mb-2 w-56 rounded-lg shadow-lg border overflow-hidden"
          style={{
            backgroundColor: 'var(--color-sidebar)',
            borderColor: 'var(--color-dropdown-border)'
          }}
        >
          {/* User Info Section */}
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-dropdown-border)' }}>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
              >
                <User className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">User</div>
                <div className="text-xs text-muted-foreground truncate">user@example.com</div>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            {menuItems.map((item, index) => (
              <button
                key={index}
                onClick={item.onClick}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                  'hover:bg-white/10',
                  item.danger && 'text-red-400'
                )}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center gap-3 p-3 rounded-lg transition-colors',
          'hover:bg-white/10',
          isOpen && 'bg-white/10'
        )}
        title="Account"
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
        >
          <User className="w-4 h-4" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="text-sm font-medium truncate">User</div>
          <div className="text-xs text-muted-foreground truncate">Free Plan</div>
        </div>
      </button>
    </div>
  )
}
