import { useCallback, useRef, useState } from 'react'
import type { HitLocation } from '../types'
import type { ContactTrajectory } from '../types'

/** Normalized field: home at bottom center, fair wedge 90°. x,y in 0-1. */
function isFair(x: number, y: number): boolean {
  if (y <= 0) return false
  const halfWidth = 0.5 * y
  return x >= 0.5 - halfWidth && x <= 0.5 + halfWidth
}

function clientToLocation(clientX: number, clientY: number, rect: DOMRect): HitLocation {
  const x = (clientX - rect.left) / rect.width
  const rawY = (clientY - rect.top) / rect.height
  const y = 1 - rawY
  const fair = isFair(x, y)
  return { x, y, fair }
}

interface BaseballFieldProps {
  /** Current selection for display */
  selected?: HitLocation | null
  /** Contact points to show (spray chart) - trajectory determines color */
  contactPoints?: Array<{ location: HitLocation; trajectory: ContactTrajectory }>
  /** Called when user taps or drags on the field */
  onSelect?: (location: HitLocation) => void
  /** Size in px */
  size?: number
  interactive?: boolean
  /** Allow dragging the selected point */
  draggable?: boolean
}

export function BaseballField({
  selected,
  contactPoints = [],
  onSelect,
  size = 200,
  interactive = true,
  draggable = false,
}: BaseballFieldProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dragLocation, setDragLocation] = useState<HitLocation | null>(null)
  const justFinishedDrag = useRef(false)
  const isDragging = dragLocation !== null

  const displayLocation = isDragging ? dragLocation : selected

  const handlePointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!onSelect || !interactive || !svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const loc = clientToLocation(clientX, clientY, rect)
      onSelect(loc)
    },
    [onSelect, interactive]
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!onSelect || !interactive || !svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const loc = clientToLocation(e.clientX, e.clientY, rect)
      if (draggable && selected) {
        const sx = selected.x * 100
        const sy = (1 - selected.y) * 100
        const px = (e.clientX - rect.left) / rect.width * 100
        const py = (1 - (e.clientY - rect.top) / rect.height) * 100
        const dist = Math.hypot(px - sx, py - sy)
        if (dist < 18) {
          e.preventDefault()
          svgRef.current.setPointerCapture?.(e.pointerId)
          setDragLocation(loc)
          return
        }
      }
      handlePointer(e.clientX, e.clientY)
    },
    [onSelect, interactive, draggable, selected, handlePointer]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const loc = clientToLocation(e.clientX, e.clientY, rect)
      setDragLocation(loc)
    },
    [isDragging]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (isDragging && dragLocation) {
        svgRef.current?.releasePointerCapture?.(e.pointerId)
        onSelect?.(dragLocation)
        justFinishedDrag.current = true
        setDragLocation(null)
      }
    },
    [isDragging, dragLocation, onSelect]
  )

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (justFinishedDrag.current) {
        justFinishedDrag.current = false
        return
      }
      if (isDragging) return
      handlePointer(e.clientX, e.clientY)
    },
    [handlePointer, isDragging]
  )

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      if (!onSelect || !interactive || isDragging) return
      e.preventDefault()
      const touch = e.changedTouches[0]
      handlePointer(touch.clientX, touch.clientY)
    },
    [handlePointer, onSelect, interactive, isDragging]
  )

  const trajectoryColor = (t: ContactTrajectory): string => {
    switch (t) {
      case 'groundball':
        return '#2563eb'
      case 'line_drive':
        return '#eab308'
      case 'flyball':
      case 'pop_up':
        return '#dc2626'
      default:
        return '#6b7280'
    }
  }

  return (
    <div
      className="baseball-field-wrapper"
      style={{ width: size, height: size }}
    >
      <img
        src="/baseball-field.png"
        alt="Baseball field"
        className="baseball-field-bg"
      />
      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="baseball-field-overlay"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: isDragging ? 'none' : 'manipulation', cursor: interactive ? (isDragging ? 'grabbing' : 'crosshair') : 'default' }}
      >
      {/* Contact points (spray chart) - y flipped: 0=home(bottom), 1=outfield(top) */}
      {contactPoints.map(({ location, trajectory }, i) => {
        const px = location.x * 100
        const py = (1 - location.y) * 100
        const color = trajectoryColor(trajectory)
        return (
          <g key={i}>
            <circle
              cx={px}
              cy={py}
              r="3"
              fill={color}
              stroke="#fff"
              strokeWidth="1"
            />
          </g>
        )
      })}

      {/* Selected point - draggable when draggable prop is true */}
      {displayLocation && (
        <g>
          <circle
            cx={displayLocation.x * 100}
            cy={(1 - displayLocation.y) * 100}
            r="6"
            fill={isDragging ? 'rgba(220,38,38,0.5)' : 'none'}
            stroke="#dc2626"
            strokeWidth="2"
          />
          {draggable && (
            <circle
              cx={displayLocation.x * 100}
              cy={(1 - displayLocation.y) * 100}
              r="18"
              fill="transparent"
            />
          )}
        </g>
      )}
      </svg>
    </div>
  )
}
