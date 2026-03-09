import type { AtBat } from '../types'
import { formatAtBatResult } from '../lib/stats'

interface Props {
  atBat: AtBat | undefined
  label?: string
}

export function BatterLastAtBat({ atBat, label = "Last AB" }: Props) {
  if (!atBat) {
    return (
      <div className="batter-last-ab empty">
        <span className="label">{label}</span>
        <span className="value">No previous AB</span>
      </div>
    )
  }

  const result = formatAtBatResult(atBat.result)
  const pitchCount = atBat.pitches.length

  return (
    <div className="batter-last-ab">
      <span className="label">{label}</span>
      <div className="content">
        <span className="result">{result}</span>
        <span className="detail">
          {pitchCount} pitch{pitchCount !== 1 ? 'es' : ''}
        </span>
      </div>
    </div>
  )
}
