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

const DRAG_SENSITIVITY = 12 // pixels per step (lower = easier to drag, more responsive on touch)
const WHEEL_VISIBLE_ROWS = 5 // show 2 above + center + 2 below for context

interface SegmentWheelProps {
  value: number
  min: number
  max: number
  pad?: number
  segment: Segment
  onPointerStart: (segment: Segment) => (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerEnd: () => void
  onTouchStart: (segment: Segment) => (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: () => void
}

function SegmentWheel({
  value,
  min,
  max,
  pad = 2,
  segment,
  onPointerStart,
  onPointerMove,
  onPointerEnd,
  onTouchStart,
  onTouchMove,
  onTouchEnd
}: SegmentWheelProps) {
  const half = Math.floor(WHEEL_VISIBLE_ROWS / 2)
  const rows: number[] = []
  for (let i = -half; i <= half; i++) {
    rows.push(Math.min(max, Math.max(min, value + i)))
  }

  const format = (v: number) => v.toString().padStart(pad, '0')

  return (
    <div
      className="time-input-segment time-input-segment-wheel"
      onPointerDown={onPointerStart(segment)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onPointerLeave={onPointerEnd}
      onTouchStart={onTouchStart(segment)}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div className="time-input-wheel-track">
        {rows.map((v, i) => (
          <div
            key={`${v}-${i}`}
            className={`time-input-wheel-row ${i === half ? 'time-input-wheel-center' : ''}`}
          >
            {format(v)}
          </div>
        ))}
      </div>
    </div>
  )
}

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

  const maxMinutes = Math.floor(max / 60)

  const updatePart = (segment: Segment, delta: number) => {
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
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
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
        <SegmentWheel
          value={parts.minutes}
          min={0}
          max={maxMinutes}
          pad={2}
          segment="minutes"
          onPointerStart={handlePointerStart}
          onPointerMove={handlePointerMove}
          onPointerEnd={handlePointerEnd}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
        <span className="time-input-segment-sep">:</span>
        <SegmentWheel
          value={parts.seconds}
          min={0}
          max={59}
          pad={2}
          segment="seconds"
          onPointerStart={handlePointerStart}
          onPointerMove={handlePointerMove}
          onPointerEnd={handlePointerEnd}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
        <span className="time-input-segment-sep">:</span>
        <SegmentWheel
          value={parts.tenths}
          min={0}
          max={9}
          pad={1}
          segment="tenths"
          onPointerStart={handlePointerStart}
          onPointerMove={handlePointerMove}
          onPointerEnd={handlePointerEnd}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      </div>
    </label>
  )
}
