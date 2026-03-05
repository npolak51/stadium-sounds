import { useRef } from 'react'
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

const DRAG_SENSITIVITY = 18 // pixels per step

export default function TimeInput({
  value,
  onChange,
  min = 0,
  max = 5999,
  step = 1,
  label
}: TimeInputProps) {
  const displayValue = secondsToMMSS(value)
  const touchStartRef = useRef<{ y: number; value: number } | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      y: e.touches[0].clientY,
      value
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    e.preventDefault()
    const deltaY = touchStartRef.current.y - e.touches[0].clientY // up = positive
    const steps = Math.round(deltaY / DRAG_SENSITIVITY)
    if (steps !== 0) {
      const newValue = Math.min(max, Math.max(min, touchStartRef.current.value + steps * step))
      onChange(newValue)
      touchStartRef.current = { y: e.touches[0].clientY, value: newValue }
    }
  }

  const handleTouchEnd = () => {
    touchStartRef.current = null
  }

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
      <div
        className="time-input"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
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
