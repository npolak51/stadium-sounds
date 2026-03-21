import type { Game } from '../types'
import {
  getPitchStatsByType,
  formatAtBatResult,
  getInningsPitched,
  getWHIP,
  getFirstPitchStrikePct,
  getSwingAndMissRateByType,
  getBAA,
  getPitchesPerBatter,
  getContactTypeCounts,
  getContactTrajectoryCounts,
  getGameContactPoints,
  getStrikeouts,
  getWalks,
  getStrikeoutPitchTypes,
  getOffspeedStrikes,
  getOffspeedFirstPitchStrikes,
} from '../lib/stats'
import { PITCH_LABELS, CONTACT_LABELS, TRAJECTORY_LABELS } from '../lib/constants'
import type { PitchType } from '../types'
import { BaseballField } from './BaseballField'

interface Props {
  game: Game
  /** When true, header shows "Game vs Opponent" (all pitchers) instead of pitcher name */
  overall?: boolean
}

export function PostGameReport({ game, overall }: Props) {
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
      <h2>{overall ? 'Game Report' : 'Post-Game Report'}</h2>
      <div className="report-meta">
        <p>
          {overall ? (
            <>Game vs <strong>{game.opponent}</strong> <span className="meta-note">(all pitchers)</span></>
          ) : (
            <><strong>{game.pitcher.name}</strong> vs {game.opponent}</>
          )}
        </p>
        <p>{new Date(game.date).toLocaleDateString()}</p>
        {game.location && <p>{game.location}</p>}
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
            <span className="value">{getStrikeouts(game)}</span>
            <span className="label">Strikeouts</span>
          </div>
          <div className="stat">
            <span className="value">{getWalks(game)}</span>
            <span className="label">Walks</span>
          </div>
          <div className="stat">
            <span className="value">{game.atBats.length}</span>
            <span className="label">Batters Faced</span>
          </div>
          <div className="stat">
            <span className="value">{getInningsPitched(game).toFixed(1)}</span>
            <span className="label">Innings</span>
          </div>
          <div className="stat">
            <span className="value">{getWHIP(game)}</span>
            <span className="label">WHIP</span>
          </div>
          <div className="stat">
            <span className="value">
              {getFirstPitchStrikePct(game)}
              {getFirstPitchStrikePct(game) !== '—' ? '%' : ''}
            </span>
            <span className="label">1st Pitch Strike %</span>
          </div>
          <div className="stat">
            <span className="value">{getBAA(game)}</span>
            <span className="label">BAA</span>
          </div>
          <div className="stat">
            <span className="value">{getPitchesPerBatter(game)}</span>
            <span className="label">Pitches/Batter</span>
          </div>
          <div className="stat">
            <span className="value">{getOffspeedStrikes(game)}</span>
            <span className="label">Offspeed Strikes</span>
          </div>
          <div className="stat">
            <span className="value">{getOffspeedFirstPitchStrikes(game)}</span>
            <span className="label">Offspeed 1st Pitch Strikes</span>
          </div>
        </div>
      </section>

      {Object.keys(getStrikeoutPitchTypes(game)).length > 0 && (
        <section className="report-section">
          <h3>Strikeout pitch (last pitch of each K)</h3>
          <div className="k-pitch-breakdown">
            {Object.entries(getStrikeoutPitchTypes(game))
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <span key={type} className="k-pitch-item">
                  {PITCH_LABELS[type as PitchType] ?? type}: {count}
                </span>
              ))}
          </div>
        </section>
      )}

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
              <th>Sw/Miss %</th>
            </tr>
          </thead>
          <tbody>
            {pitchRows.map(([type, s]) => {
              const pct =
                s.thrown > 0 ? ((s.strikes / s.thrown) * 100).toFixed(1) : '0'
              const swMiss = getSwingAndMissRateByType(game)[type]
              return (
                <tr key={type}>
                  <td>{PITCH_LABELS[type as keyof typeof PITCH_LABELS] ?? type}</td>
                  <td>{s.thrown}</td>
                  <td>{s.strikes}</td>
                  <td>{s.balls}</td>
                  <td>{pct}%</td>
                  <td>{swMiss?.rate ?? '—'}{swMiss?.rate && swMiss.rate !== '—' ? '%' : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="report-section">
        <h3>Contact Metrics</h3>
        <div className="contact-metrics">
          {(() => {
            const typeCounts = getContactTypeCounts(game)
            const trajCounts = getContactTrajectoryCounts(game)
            const typeTotal = Object.values(typeCounts).reduce((a, b) => a + b, 0)
            const trajTotal = Object.values(trajCounts).reduce((a, b) => a + b, 0)
            if (typeTotal === 0 && trajTotal === 0) return <p className="no-data">No contact data recorded</p>
            return (
              <>
                {typeTotal > 0 && (
                  <div className="contact-metrics-group">
                    <h4>Contact quality (%)</h4>
                    <div className="contact-type-grid">
                      {(['hard', 'average', 'weak', 'bunt'] as const).map((type) => {
                        const pct = ((typeCounts[type] ?? 0) / typeTotal * 100).toFixed(1)
                        return (
                          <div key={type} className="contact-stat">
                            <span className="value">{pct}%</span>
                            <span className="label">{CONTACT_LABELS[type]}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {trajTotal > 0 && (
                  <div className="contact-metrics-group">
                    <h4>Contact trajectory (%)</h4>
                    <div className="contact-type-grid">
                      {(['groundball', 'line_drive', 'flyball', 'pop_up'] as const).map((traj) => {
                        const pct = ((trajCounts[traj] ?? 0) / trajTotal * 100).toFixed(1)
                        return (
                          <div key={traj} className="contact-stat">
                            <span className="value">{pct}%</span>
                            <span className="label">{TRAJECTORY_LABELS[traj]}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      </section>

      <section className="report-section">
        <h3>Spray Chart</h3>
        <div className="report-spray-chart">
          {(() => {
            const points = getGameContactPoints(game)
            if (points.length === 0) return <p className="no-data">No hit locations recorded</p>
            return (
              <>
                <div className="spray-legend">
                  <span className="legend-item gb">GB</span>
                  <span className="legend-item ld">LD</span>
                  <span className="legend-item fb">FB/Pop</span>
                </div>
                <BaseballField contactPoints={points} interactive={false} size={220} />
              </>
            )
          })()}
        </div>
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
