import type { Pitch } from '../types'
import { formatPitchSequence } from '../lib/stats'

interface Props {
  pitches: Pitch[]
}

export function PitchSequence({ pitches }: Props) {
  const sequence = pitches.length > 0 ? formatPitchSequence(pitches) : '—'
  const isEmpty = pitches.length === 0
  return (
    <div className={`pitch-sequence ${isEmpty ? 'pitch-sequence--empty' : ''}`}>
      <span className="label">Sequence</span>
      <span className="value">{sequence}</span>
    </div>
  )
}
