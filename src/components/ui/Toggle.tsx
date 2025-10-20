// Reusable Toggle Switch Component with better visibility
interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export function Toggle({ checked, onChange, disabled = false }: ToggleProps) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="sr-only peer"
      />
      <div 
        className={`
          w-11 h-6 rounded-full peer 
          transition-all duration-200
          peer-focus:outline-none peer-focus:ring-4 
          after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
          after:rounded-full after:h-5 after:w-5 
          after:transition-all after:shadow-md
          peer-checked:after:translate-x-full
          peer-disabled:opacity-50 peer-disabled:cursor-not-allowed
          ${checked 
            ? 'bg-green-500 peer-focus:ring-green-500/20 after:bg-white' 
            : 'bg-gray-600 dark:bg-gray-700 peer-focus:ring-gray-500/20 after:bg-white'
          }
        `}
      />
    </label>
  )
}
