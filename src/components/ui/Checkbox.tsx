// Modern Checkbox Component with smooth animations
import { Check } from 'lucide-react'

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
  description?: string
}

export function Checkbox({ 
  checked, 
  onChange, 
  disabled = false,
  label,
  description 
}: CheckboxProps) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      <div className="relative flex items-center justify-center mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <div
          className={`
            w-5 h-5 rounded border-2 
            transition-all duration-200 ease-in-out
            flex items-center justify-center
            ${checked
              ? 'bg-primary border-primary scale-100'
              : 'bg-transparent border-gray-400 dark:border-gray-600 scale-100 hover:border-primary/50'
            }
            ${disabled ? '' : 'peer-focus:ring-4 peer-focus:ring-primary/20'}
          `}
        >
          <Check
            className={`
              w-3.5 h-3.5 text-white
              transition-all duration-200
              ${checked ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}
            `}
            strokeWidth={3}
          />
        </div>
      </div>
      
      {(label || description) && (
        <div className="flex-1">
          {label && (
            <div className="text-sm font-medium text-foreground">
              {label}
            </div>
          )}
          {description && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {description}
            </div>
          )}
        </div>
      )}
    </label>
  )
}
