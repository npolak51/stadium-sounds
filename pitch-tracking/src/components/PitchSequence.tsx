import type { Pitch } from '../types'
import { formatPitchSequence } from '../lib/stats'

interface Props {
  pitches: Pitch[]
}

export function PitchSequence({ pitches }: Props) {
  if (pitches.length === 0) return null

  const sequence = formatPitchSequence(pitches)
  return (
    <div className="pitch-sequence">
      <span className="label">Sequence</span>
      <span className="value">{sequence}</span>
    </div>
  )
}
