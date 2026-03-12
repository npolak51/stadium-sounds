import type { Game } from '../types'

interface TrendPoint {
  date: string
  opponent: string
  pitches: number
  strikes: number
  strikePct: number
}

interface Props {
  games: Game[]
}

export function TrendsChart({ games }: Props) {
  const trends: TrendPoint[] = games.map((g) => {
    const pitches = g.atBats.reduce((s, ab) => s + ab.pitches.length, 0)
    const strikes = g.atBats.reduce(
      (s, ab) =>
        s +
        ab.pitches.filter(
          (p) =>
            p.result === 'whiff' ||
            p.result === 'called_strike' ||
            p.result === 'foul' ||
            p.result === 'in_play'
        ).length,
      0
    )
    return {
      date: g.date,
      opponent: g.opponent,
      pitches,
      strikes,
      strikePct: pitches > 0 ? (strikes / pitches) * 100 : 0,
    }
  })

  if (trends.length === 0) return null

  return (
    <div className="trends-chart">
      <div className="trends-chart-bars">
        {trends.map((t, i) => (
          <div key={`${t.date}-${t.opponent}-${i}`} className="trend-bar-container">
            <div className="trend-bar-track">
              <div
                className="trend-bar"
                style={{ width: `${Math.min(100, t.strikePct)}%` }}
                title={`${t.opponent}: ${t.strikePct.toFixed(1)}% (${t.pitches} pitches)`}
              />
            </div>
            <div className="trend-bar-label">
              <span className="trend-opponent">{t.opponent}</span>
              <span className="trend-pct">{t.strikePct.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
