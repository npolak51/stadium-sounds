import type { Game } from '../types'
import { getPitchStatsByType, formatAtBatResult } from '../lib/stats'

interface Props {
  game: Game
}

const PITCH_LABELS: Record<string, string> = {
  fastball: 'Fastball',
  curveball: 'Curveball',
  slider: 'Slider',
  changeup: 'Changeup',
  cutter: 'Cutter',
  splitter: 'Splitter',
}

export function PostGameReport({ game }: Props) {
  const pitchStats = getPitchStatsByType(game)
  const totalPitches = game.atBats.reduce((sum, ab) => sum + ab.pitches.length, 0)
  const totalStrikes = game.atBats.reduce(
    (sum, ab) =>
      sum +
      ab.pitches.filter(
        (p) =>
          p.result === 'whiff' ||
          p.result === 'called_strike' ||
          p.result === 'foul' ||
          p.result === 'in_play'
      ).length,
    0
  )
  const strikePct =
    totalPitches > 0 ? ((totalStrikes / totalPitches) * 100).toFixed(1) : '0'

  const pitchRows = Object.entries(pitchStats)
    .filter(([, s]) => s.thrown > 0)
    .sort((a, b) => b[1].thrown - a[1].thrown)

  return (
    <div className="post-game-report">
      <h2>Post-Game Report</h2>
      <div className="report-meta">
        <p>
          <strong>{game.pitcher.name}</strong> vs {game.opponent}
        </p>
        <p>{new Date(game.date).toLocaleDateString()}</p>
      </div>

      <section className="report-section">
        <h3>Summary</h3>
        <div className="summary-stats">
          <div className="stat">
            <span className="value">{totalPitches}</span>
            <span className="label">Total Pitches</span>
          </div>
          <div className="stat">
            <span className="value">{strikePct}%</span>
            <span className="label">Strike %</span>
          </div>
          <div className="stat">
            <span className="value">{game.atBats.length}</span>
            <span className="label">Batters Faced</span>
          </div>
        </div>
      </section>

      <section className="report-section">
        <h3>Pitch Breakdown</h3>
        <table className="pitch-table">
          <thead>
            <tr>
              <th>Pitch</th>
              <th>Thrown</th>
              <th>Strikes</th>
              <th>Balls</th>
              <th>Strike %</th>
            </tr>
          </thead>
          <tbody>
            {pitchRows.map(([type, s]) => {
              const pct =
                s.thrown > 0 ? ((s.strikes / s.thrown) * 100).toFixed(1) : '0'
              return (
                <tr key={type}>
                  <td>{PITCH_LABELS[type] ?? type}</td>
                  <td>{s.thrown}</td>
                  <td>{s.strikes}</td>
                  <td>{s.balls}</td>
                  <td>{pct}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="report-section">
        <h3>At-Bats</h3>
        <div className="at-bat-list">
          {game.atBats.map((ab, i) => (
            <div key={ab.id} className="at-bat-row">
              <span className="index">{i + 1}.</span>
              <span className="batter">
                {ab.batter.name || ab.batter.jerseyNumber
                  ? `${ab.batter.name || ''}${ab.batter.jerseyNumber ? ` #${ab.batter.jerseyNumber}` : ''}`.trim()
                  : 'Batter'}
              </span>
              <span className="result">{formatAtBatResult(ab.result)}</span>
              <span className="pitches">{ab.pitches.length} pitches</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
