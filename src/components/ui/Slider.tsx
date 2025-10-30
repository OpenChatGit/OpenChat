// Modern Slider Component with smooth animations and better visibility
interface SliderProps {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  disabled?: boolean
  label?: string
  showValue?: boolean
  valueFormatter?: (value: number) => string
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled = false,
  label,
  showValue = true,
  valueFormatter = (v) => v.toString()
}: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100

  return (
    <div className="space-y-2">
      {/* Label and Value */}
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && (
            <label className="text-sm font-medium text-foreground">
              {label}
            </label>
          )}
          {showValue && (
            <span className="text-sm text-muted-foreground font-mono">
              {valueFormatter(value)}
            </span>
          )}
        </div>
      )}

      {/* Slider Track */}
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="slider-input"
          style={{
            background: `linear-gradient(to right, 
              var(--color-primary) 0%, 
              var(--color-primary) ${percentage}%, 
              rgb(75, 85, 99) ${percentage}%, 
              rgb(75, 85, 99) 100%)`
          }}
        />
      </div>

      {/* Min/Max Labels */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{valueFormatter(min)}</span>
        <span>{valueFormatter(max)}</span>
      </div>

      <style>{`
        .slider-input {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 8px;
          border-radius: 9999px;
          outline: none;
          transition: all 0.2s ease-in-out;
        }

        .slider-input:hover {
          opacity: 0.9;
        }

        .slider-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .slider-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          transition: all 0.2s ease-in-out;
          border: 2px solid var(--color-primary);
        }

        .slider-input::-webkit-slider-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }

        .slider-input::-webkit-slider-thumb:active {
          transform: scale(1.05);
        }

        .slider-input::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          transition: all 0.2s ease-in-out;
          border: 2px solid var(--color-primary);
        }

        .slider-input::-moz-range-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }

        .slider-input::-moz-range-thumb:active {
          transform: scale(1.05);
        }

        .slider-input:disabled::-webkit-slider-thumb {
          cursor: not-allowed;
        }

        .slider-input:disabled::-moz-range-thumb {
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}
