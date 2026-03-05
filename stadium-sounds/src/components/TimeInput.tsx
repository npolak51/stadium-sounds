import { useRef } from 'react'
import './TimeInput.css'

function secondsToParts(sec: number): { minutes: number; seconds: number; tenths: number } {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  const t = Math.floor((sec % 1) * 10)
  return { minutes: m, seconds: s, tenths: t }
}

function partsToSeconds(parts: { minutes: number; seconds: number; tenths: number }): number {
  return parts.minutes * 60 + parts.seconds + parts.tenths / 10
}

type Segment = 'minutes' | 'seconds' | 'tenths'

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
  label
}: TimeInputProps) {
  const parts = secondsToParts(value)
  const touchStartRef = useRef<{
    y: number
    segment: Segment
    value: number
  } | null>(null)

  const updatePart = (segment: Segment, delta: number) => {
    const maxMinutes = Math.floor(max / 60)
    const maxSeconds = 59
    const maxTenths = 9

    let newParts = { ...parts }
    if (segment === 'minutes') {
      newParts.minutes = Math.min(maxMinutes, Math.max(0, parts.minutes + delta))
    } else if (segment === 'seconds') {
      newParts.seconds = Math.min(maxSeconds, Math.max(0, parts.seconds + delta))
    } else {
      newParts.tenths = Math.min(maxTenths, Math.max(0, parts.tenths + delta))
    }
    const newValue = Math.min(max, Math.max(min, partsToSeconds(newParts)))
    onChange(newValue)
  }

  const handlePointerStart = (segment: Segment) => (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId)
    touchStartRef.current = {
      y: e.clientY,
      segment,
      value
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!touchStartRef.current) return
    e.preventDefault()
    const deltaY = touchStartRef.current.y - e.clientY // up = positive
    const steps = Math.round(deltaY / DRAG_SENSITIVITY)
    if (steps !== 0) {
      const seg = touchStartRef.current.segment
      updatePart(seg, steps)
      touchStartRef.current = { ...touchStartRef.current, y: e.clientY }
    }
  }

  const handlePointerEnd = () => {
    touchStartRef.current = null
  }

  const handleTouchStart = (segment: Segment) => (e: React.TouchEvent) => {
    touchStartRef.current = {
      y: e.touches[0].clientY,
      segment,
      value
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    e.preventDefault()
    const deltaY = touchStartRef.current.y - e.touches[0].clientY
    const steps = Math.round(deltaY / DRAG_SENSITIVITY)
    if (steps !== 0) {
      const seg = touchStartRef.current.segment
      updatePart(seg, steps)
      touchStartRef.current = { ...touchStartRef.current, y: e.touches[0].clientY }
    }
  }

  const handleTouchEnd = () => {
    touchStartRef.current = null
  }

  return (
    <label className="time-input-wrap">
      {label && <span className="time-input-label">{label}</span>}
      <div className="time-input time-input-segments">
        <div
          className="time-input-segment"
          onPointerDown={handlePointerStart('minutes')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onTouchStart={handleTouchStart('minutes')}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {parts.minutes.toString().padStart(2, '0')}
        </div>
        <span className="time-input-segment-sep">:</span>
        <div
          className="time-input-segment"
          onPointerDown={handlePointerStart('seconds')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onTouchStart={handleTouchStart('seconds')}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {parts.seconds.toString().padStart(2, '0')}
        </div>
        <span className="time-input-segment-sep">:</span>
        <div
          className="time-input-segment time-input-segment-tenths"
          onPointerDown={handlePointerStart('tenths')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onTouchStart={handleTouchStart('tenths')}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {parts.tenths}
        </div>
      </div>
    </label>
  )
}
