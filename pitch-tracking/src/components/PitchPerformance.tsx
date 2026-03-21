import type { Game, PitchType } from '../types'
import { getPitchStatsByType } from '../lib/stats'
import { PITCH_ABBREV } from '../lib/constants'

interface Props {
  game: Game
}

export function PitchPerformance({ game }: Props) {
  const stats = getPitchStatsByType(game)

  const rows = (Object.entries(stats) as [PitchType, (typeof stats)[PitchType]][])
    .filter(([, s]) => s.thrown > 0)
    .sort((a, b) => b[1].thrown - a[1].thrown)

  if (rows.length === 0) {
    return (
      <div className="pitch-performance empty">
        <span className="label">Pitch performance</span>
        <span className="value">No pitches yet</span>
      </div>
    )
  }

  return (
    <div className="pitch-performance">
      <span className="label">Pitch performance (this game)</span>
      <div className="stats-grid">
        {rows.map(([type, s]) => {
          const strikePct =
            s.thrown > 0 ? ((s.strikes / s.thrown) * 100).toFixed(0) : '0'
          return (
            <div key={type} className="pitch-row">
              <span className="pitch-type">{PITCH_ABBREV[type]}</span>
              <span className="pitch-count">{s.thrown}</span>
              <span className="pitch-strikes">{s.strikes}S</span>
              <span className="pitch-balls">{s.balls}B</span>
              <span className="pitch-pct">{strikePct}% strikes</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
