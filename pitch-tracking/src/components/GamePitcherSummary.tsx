import { Link } from 'react-router-dom'
import type { Game } from '../types'
import {
  getGameFilteredByPitcher,
  getPitchStatsByType,
  getInningsPitched,
  getWHIP,
  getFirstPitchStrikePct,
  getBAA,
  getPitchesPerBatter,
  getSwingAndMissRateByType,
  getStrikeouts,
  getWalks,
  getStrikeoutPitchTypes,
  getOffspeedStrikes,
  getOffspeedFirstPitchStrikes,
  getGameContactPoints,
  getContactTypeCounts,
  getContactTrajectoryCounts,
} from '../lib/stats'
import { PITCH_LABELS, CONTACT_LABELS, TRAJECTORY_LABELS } from '../lib/constants'
import type { PitchType } from '../types'
import { BaseballField } from './BaseballField'

interface Props {
  game: Game
  pitcherId: string
  pitcherName: string
  atBatCount: number
}

export function GamePitcherSummary({ game, pitcherId, pitcherName, atBatCount }: Props) {
  const filtered = getGameFilteredByPitcher(game, pitcherId)
  const pitchStats = getPitchStatsByType(filtered)
  const swMiss = getSwingAndMissRateByType(filtered)

  const totalPitches = filtered.atBats.reduce((sum, ab) => sum + ab.pitches.length, 0)
  const totalStrikes = filtered.atBats.reduce(
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
    <div className="game-pitcher-summary">
      <div className="summary-header">
        <h4>{pitcherName}</h4>
        <span className="at-bat-count">{atBatCount} batters faced</span>
        <Link to={`/reports/pitcher/${pitcherId}`} className="link-pitcher-report">
          View full pitcher report →
        </Link>
      </div>
      <div className="summary-stats">
        <div className="stat">
          <span className="value">{totalPitches}</span>
          <span className="label">Pitches</span>
        </div>
        <div className="stat">
          <span className="value">{strikePct}%</span>
          <span className="label">Strike %</span>
        </div>
        <div className="stat">
          <span className="value">{getStrikeouts(filtered)}</span>
          <span className="label">K</span>
        </div>
        <div className="stat">
          <span className="value">{getWalks(filtered)}</span>
          <span className="label">BB</span>
        </div>
        <div className="stat">
          <span className="value">{getInningsPitched(filtered).toFixed(1)}</span>
          <span className="label">IP</span>
        </div>
        <div className="stat">
          <span className="value">{getWHIP(filtered)}</span>
          <span className="label">WHIP</span>
        </div>
        <div className="stat">
          <span className="value">
            {getFirstPitchStrikePct(filtered)}
            {getFirstPitchStrikePct(filtered) !== '—' ? '%' : ''}
          </span>
          <span className="label">1st Strike %</span>
        </div>
        <div className="stat">
          <span className="value">{getBAA(filtered)}</span>
          <span className="label">BAA</span>
        </div>
        <div className="stat">
          <span className="value">{getPitchesPerBatter(filtered)}</span>
          <span className="label">Pitches/Batter</span>
        </div>
        <div className="stat">
          <span className="value">{getOffspeedStrikes(filtered)}</span>
          <span className="label">Offspeed Strikes</span>
        </div>
        <div className="stat">
          <span className="value">{getOffspeedFirstPitchStrikes(filtered)}</span>
          <span className="label">Offspeed 1st Strikes</span>
        </div>
      </div>
      {Object.keys(getStrikeoutPitchTypes(filtered)).length > 0 && (
        <div className="k-pitch-breakdown k-pitch-breakdown-compact">
          {Object.entries(getStrikeoutPitchTypes(filtered))
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => (
              <span key={type} className="k-pitch-item">
                {PITCH_LABELS[type as PitchType] ?? type}: {count}
              </span>
            ))}
        </div>
      )}
      <table className="pitch-table pitch-table-compact">
        <thead>
          <tr>
            <th>Pitch</th>
            <th>Thrown</th>
            <th>Strikes</th>
            <th>Strike %</th>
            <th>Sw/Miss %</th>
          </tr>
        </thead>
        <tbody>
          {pitchRows.map(([type, s]) => {
            const pct =
              s.thrown > 0 ? ((s.strikes / s.thrown) * 100).toFixed(1) : '0'
            const sm = swMiss[type]
            const swMissPct =
              sm?.swings && sm.swings > 0
                ? ((sm.whiffs / sm.swings) * 100).toFixed(1)
                : '—'
            return (
              <tr key={type}>
                <td>{PITCH_LABELS[type as PitchType] ?? type}</td>
                <td>{s.thrown}</td>
                <td>{s.strikes}</td>
                <td>{pct}%</td>
                <td>{swMissPct}{swMissPct !== '—' ? '%' : ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {(() => {
        const typeCounts = getContactTypeCounts(filtered)
        const trajCounts = getContactTrajectoryCounts(filtered)
        const typeTotal = Object.values(typeCounts).reduce((a, b) => a + b, 0)
        const trajTotal = Object.values(trajCounts).reduce((a, b) => a + b, 0)
        if (typeTotal > 0 || trajTotal > 0) {
          return (
            <div className="game-pitcher-contact-metrics">
              {typeTotal > 0 && (
                <div className="contact-metrics-row">
                  <span className="contact-metrics-label">Contact:</span>
                  {(['hard', 'average', 'weak', 'bunt'] as const).map((type) => {
                    const pct = ((typeCounts[type] ?? 0) / typeTotal * 100).toFixed(0)
                    return (
                      <span key={type} className="contact-metric-item">
                        {CONTACT_LABELS[type]} {pct}%
                      </span>
                    )
                  })}
                </div>
              )}
              {trajTotal > 0 && (
                <div className="contact-metrics-row">
                  <span className="contact-metrics-label">Trajectory:</span>
                  {(['groundball', 'line_drive', 'flyball', 'pop_up'] as const).map((traj) => {
                    const pct = ((trajCounts[traj] ?? 0) / trajTotal * 100).toFixed(0)
                    return (
                      <span key={traj} className="contact-metric-item">
                        {TRAJECTORY_LABELS[traj]} {pct}%
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          )
        }
        return null
      })()}
      {(() => {
        const points = getGameContactPoints(filtered)
        if (points.length === 0) return null
        return (
          <div className="game-pitcher-spray">
            <h4>Spray chart</h4>
            <div className="spray-legend">
              <span className="legend-item gb">GB</span>
              <span className="legend-item ld">LD</span>
              <span className="legend-item fb">FB/Pop</span>
            </div>
            <BaseballField contactPoints={points} interactive={false} size={180} />
          </div>
        )
      })()}
    </div>
  )
}
