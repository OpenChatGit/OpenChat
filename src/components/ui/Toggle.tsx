// Modern Toggle Switch Component with smooth animations and better visibility
interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function Toggle({ checked, onChange, disabled = false, size = 'md' }: ToggleProps) {
  // Size configurations
  const sizes = {
    sm: {
      track: 'w-9 h-5',
      thumb: 'w-4 h-4',
      thumbOffset: 'left-0.5',
      translate: 'translate-x-4'
    },
    md: {
      track: 'w-11 h-6',
      thumb: 'w-5 h-5',
      thumbOffset: 'left-0.5',
      translate: 'translate-x-5'
    },
    lg: {
      track: 'w-14 h-7',
      thumb: 'w-6 h-6',
      thumbOffset: 'left-0.5',
      translate: 'translate-x-7'
    }
  }

  const sizeConfig = sizes[size]

  const handleClick = () => {
    if (!disabled) {
      const newValue = !checked
      console.log('[Toggle] Click:', { from: checked, to: newValue })
      onChange(newValue)
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={handleClick}
      className={`
        relative inline-flex items-center ${sizeConfig.track} rounded-full
        transition-all duration-300 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-transparent
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'}
        ${checked 
          ? 'bg-green-500 focus:ring-green-500/50' 
          : 'bg-gray-600 dark:bg-gray-700 focus:ring-gray-500/50'
        }
      `}
    >
      {/* Thumb */}
      <span
        className={`
          ${sizeConfig.thumb} ${sizeConfig.thumbOffset} rounded-full
          bg-white shadow-md
          absolute top-0.5
          transform transition-all duration-300 ease-in-out
          ${checked ? sizeConfig.translate : 'translate-x-0'}
        `}
      />
    </button>
  )
}
