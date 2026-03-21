import type { Game } from '../types'
import {
  getPerInningStats,
  getInningsPitched,
  getWHIP,
} from '../lib/stats'

interface Props {
  game: Game
}

export function InningStats({ game }: Props) {
  const perInning = getPerInningStats(game)
  const innings = getInningsPitched(game)
  const whip = getWHIP(game)

  if (perInning.length === 0) {
    return (
      <div className="inning-stats empty">
        <span className="label">Inning stats</span>
        <span className="value">No innings yet</span>
      </div>
    )
  }

  return (
    <div className="inning-stats">
      <span className="label">Inning stats</span>
      <div className="inning-stats-summary">
        <span className="ip">{innings.toFixed(1)} IP</span>
        <span className="whip">WHIP {whip}</span>
      </div>
      <div className="inning-rows">
        {perInning.map((row) => {
          const half = row.isTopInning ? 'T' : 'B'
          const strikePct =
            row.pitches > 0
              ? ((row.strikes / row.pitches) * 100).toFixed(0)
              : '0'
          return (
            <div key={`${row.inning}-${row.isTopInning}`} className="inning-row">
              <span className="inning-num">
                {row.inning}{half}
              </span>
              <span className="inning-pitches">{row.pitches} pitches</span>
              <span className="inning-pct">{strikePct}% strikes</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
