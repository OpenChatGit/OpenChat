import { useState, useRef, useEffect } from 'react'
import { Settings, User, HelpCircle, Info, ChevronUp } from 'lucide-react'
import { cn } from '../lib/utils'

interface AccountMenuProps {
  onOpenSettings: () => void
}

export function AccountMenu({ onOpenSettings }: AccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const menuItems = [
    {
      icon: Settings,
      label: 'Settings',
      onClick: () => {
        onOpenSettings()
        setIsOpen(false)
      },
    },
    {
      icon: HelpCircle,
      label: 'Help & Support',
      onClick: () => {
        window.open('https://github.com/OpenChatGit/OpenChat', '_blank')
        setIsOpen(false)
      },
    },
    {
      icon: Info,
      label: 'About OpenChat',
      onClick: () => {
        setIsOpen(false)
        // TODO: Open about dialog
      },
    },
  ]

  return (
    <div ref={menuRef} className="relative">
      {/* Drop-up Menu */}
      {isOpen && (
        <div
          className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-white/10 shadow-lg overflow-hidden"
          style={{ backgroundColor: 'var(--color-sidebar)' }}
        >
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.onClick}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/10 transition-colors"
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Account Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center gap-3 p-3 rounded-lg transition-colors',
          isOpen ? 'bg-white/10' : 'hover:bg-white/10'
        )}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary">
          <User className="w-4 h-4" />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-medium">User</div>
          <div className="text-xs text-muted-foreground">Free Plan</div>
        </div>
        <ChevronUp
          className={cn(
            'w-4 h-4 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>
    </div>
  )
}
