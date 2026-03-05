import './TimeInput.css'

function secondsToMMSS(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function parseMMSS(value: string): number {
  const parts = value.trim().split(':')
  if (parts.length === 1) {
    const num = parseInt(parts[0], 10)
    return isNaN(num) ? 0 : Math.max(0, num)
  }
  const m = parseInt(parts[0], 10) || 0
  const s = parseInt(parts[1], 10) || 0
  return Math.max(0, m * 60 + s)
}

interface TimeInputProps {
  value: number
  onChange: (seconds: number) => void
  min?: number
  max?: number
  step?: number
  label?: string
}

export default function TimeInput({
  value,
  onChange,
  min = 0,
  max = 5999,
  step = 1,
  label
}: TimeInputProps) {
  const displayValue = secondsToMMSS(value)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseMMSS(e.target.value)
    onChange(Math.min(max, Math.max(min, parsed)))
  }

  const handleIncrement = () => {
    onChange(Math.min(max, value + step))
  }

  const handleDecrement = () => {
    onChange(Math.max(min, value - step))
  }

  return (
    <label className="time-input-wrap">
      {label && <span className="time-input-label">{label}</span>}
      <div className="time-input">
        <input
          type="text"
          className="time-input-field"
          value={displayValue}
          onChange={handleInputChange}
          placeholder="00:00"
        />
        <div className="time-input-stepper">
          <button
            type="button"
            className="time-input-btn"
            onClick={handleIncrement}
            disabled={value >= max}
            aria-label="Increase"
          >
            ▲
          </button>
          <button
            type="button"
            className="time-input-btn"
            onClick={handleDecrement}
            disabled={value <= min}
            aria-label="Decrease"
          >
            ▼
          </button>
        </div>
      </div>
    </label>
  )
}
