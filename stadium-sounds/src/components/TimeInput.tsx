import { useRef, useEffect, useCallback } from 'react'
import './TimeInput.css'

function secondsToParts(sec: number): { minutes: number; seconds: number; tenths: number } {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  // Use Math.round to avoid floating-point errors (e.g. 1.2-1.0 => 0.1999... => floor gives 1 instead of 2)
  const t = Math.min(9, Math.max(0, Math.round((sec % 1) * 10)))
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

const DRAG_SENSITIVITY = 8 // pixels per step (lower = easier to drag, more responsive on touch)
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
  onWheel: (segment: Segment) => (e: React.WheelEvent) => void
  onStep: (segment: Segment, delta: number) => void
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
  onTouchEnd,
  onWheel,
  onStep
}: SegmentWheelProps) {
  const wheelTrackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = wheelTrackRef.current
    if (!el) return
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      onTouchStart(segment)(e as unknown as React.TouchEvent<HTMLDivElement>)
    }
    const handleTouchMove = (e: TouchEvent) => {
      onTouchMove(e as unknown as React.TouchEvent<HTMLDivElement>)
      e.preventDefault()
    }
    const handleTouchEnd = () => onTouchEnd()
    const handleWheel = (e: WheelEvent) => {
      onWheel(segment)(e as unknown as React.WheelEvent<HTMLDivElement>)
      e.preventDefault()
    }
    const opts = { passive: false }
    el.addEventListener('touchstart', handleTouchStart, opts)
    el.addEventListener('touchmove', handleTouchMove, opts)
    el.addEventListener('touchend', handleTouchEnd, opts)
    el.addEventListener('touchcancel', handleTouchEnd, opts)
    el.addEventListener('wheel', handleWheel, opts)
    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
      el.removeEventListener('touchcancel', handleTouchEnd)
      el.removeEventListener('wheel', handleWheel)
    }
  }, [segment, onTouchStart, onTouchMove, onTouchEnd, onWheel])

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
    >
      <button
        type="button"
        className="time-input-step-btn time-input-step-up"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          onStep(segment, 1)
        }}
        aria-label={`Increase ${segment}`}
      >
        +
      </button>
      <div
        ref={wheelTrackRef}
        className="time-input-wheel-track"
      >
        {rows.map((v, i) => (
          <div
            key={`${v}-${i}`}
            className={`time-input-wheel-row ${i === half ? 'time-input-wheel-center' : ''}`}
          >
            {format(v)}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="time-input-step-btn time-input-step-down"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          onStep(segment, -1)
        }}
        aria-label={`Decrease ${segment}`}
      >
        −
      </button>
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
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const minMaxRef = useRef({ min: min ?? 0, max: max ?? 5999 })
  valueRef.current = value
  onChangeRef.current = onChange
  minMaxRef.current = { min: min ?? 0, max: max ?? 5999 }

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

  const handleTouchStart = useCallback((segment: Segment) => (e: React.TouchEvent) => {
    touchStartRef.current = {
      y: e.touches[0].clientY,
      segment,
      value
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    e.preventDefault()
    const deltaY = touchStartRef.current.y - e.touches[0].clientY
    const steps = Math.round(deltaY / DRAG_SENSITIVITY)
    if (steps !== 0) {
      const seg = touchStartRef.current.segment
      const { min: m, max: mx } = minMaxRef.current
      const maxMin = Math.floor(mx / 60)
      const maxSeconds = 59
      const maxTenths = 9
      const p = secondsToParts(valueRef.current)
      let newParts = { ...p }
      if (seg === 'minutes') {
        newParts.minutes = Math.min(maxMin, Math.max(0, p.minutes + steps))
      } else if (seg === 'seconds') {
        newParts.seconds = Math.min(maxSeconds, Math.max(0, p.seconds + steps))
      } else {
        newParts.tenths = Math.min(maxTenths, Math.max(0, p.tenths + steps))
      }
      const newValue = Math.min(mx, Math.max(m, partsToSeconds(newParts)))
      onChangeRef.current(newValue)
      touchStartRef.current = { ...touchStartRef.current, y: e.touches[0].clientY }
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null
  }, [])

  const handleWheel = useCallback((segment: Segment) => (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -1 : 1
    const { min: m, max: mx } = minMaxRef.current
    const maxMin = Math.floor(mx / 60)
    const maxSeconds = 59
    const maxTenths = 9
    const p = secondsToParts(valueRef.current)
    let newParts = { ...p }
    if (segment === 'minutes') {
      newParts.minutes = Math.min(maxMin, Math.max(0, p.minutes + delta))
    } else if (segment === 'seconds') {
      newParts.seconds = Math.min(maxSeconds, Math.max(0, p.seconds + delta))
    } else {
      newParts.tenths = Math.min(maxTenths, Math.max(0, p.tenths + delta))
    }
    const newValue = Math.min(mx, Math.max(m, partsToSeconds(newParts)))
    onChangeRef.current(newValue)
  }, [])

  const handleStep = useCallback((segment: Segment, delta: number) => {
    const { min: m, max: mx } = minMaxRef.current
    const maxMin = Math.floor(mx / 60)
    const maxSeconds = 59
    const maxTenths = 9
    const p = secondsToParts(valueRef.current)
    let newParts = { ...p }
    if (segment === 'minutes') {
      newParts.minutes = Math.min(maxMin, Math.max(0, p.minutes + delta))
    } else if (segment === 'seconds') {
      newParts.seconds = Math.min(maxSeconds, Math.max(0, p.seconds + delta))
    } else {
      newParts.tenths = Math.min(maxTenths, Math.max(0, p.tenths + delta))
    }
    const newValue = Math.min(mx, Math.max(m, partsToSeconds(newParts)))
    onChangeRef.current(newValue)
  }, [])

  return (
    <div className="time-input-wrap">
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
          onWheel={handleWheel}
          onStep={handleStep}
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
          onWheel={handleWheel}
          onStep={handleStep}
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
          onWheel={handleWheel}
          onStep={handleStep}
        />
      </div>
    </div>
  )
}
